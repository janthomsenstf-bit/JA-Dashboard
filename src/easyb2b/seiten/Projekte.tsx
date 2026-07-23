
import { useState } from 'react';
import {
  MOCK_INTERESSENTEN,
  getStatusLabel, getStatusColor,
  getRichtungLabel, getLandFlag,
  getKontaktZuordnungLabel, getKontaktZuordnungColor, findeFormular,
  getMatchStatusLabel, getMatchStatusColor, getMatchStatusIcon,
  type MockAnfrage, type MarktplatzStatus, type MarktplatzEintrag,
  type MatchVorschlag, type MatchStatus,
} from '@easyb2b/lib/mockdata';
import { useStore, type ProjektInteressent } from '@easyb2b/lib/store';
import {
  berechneProjekt, getGesundheitColor, getGesundheitEmoji,
  getZuordnungLabel, getZuordnungColor, type Gesundheit,
} from '@easyb2b/lib/projekte';
import { berechneAnfrageKlaerung } from '@easyb2b/lib/klaerungsstand';
import KlaerungsBox from '@easyb2b/components/KlaerungsBox';
import EditableSection, { editInputStyle, editTextareaStyle, editLabelStyle } from '@easyb2b/components/EditableSection';

// ─── HAUPTSEITE ───────────────────────────────────────────────

export default function ProjektePage() {
  const store = useStore();
  const [filterGesundheit, setFilterGesundheit] = useState<'alle' | Gesundheit>('alle');
  const [offeneIds, setOffeneIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const zeigeToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleDetail = (id: string) => {
    setOffeneIds(prev => {
      const neu = new Set(prev);
      if (neu.has(id)) neu.delete(id);
      else { neu.clear(); neu.add(id); } // nur eines gleichzeitig offen
      return neu;
    });
  };

  // Interessenten via Zuordnungs-Zwischentabelle
  const interessentenFuer = (projektId: string) => {
    const ids = store.zuordnungen.filter(z => z.projektId === projektId).map(z => z.interessentId);
    return MOCK_INTERESSENTEN.filter(i => ids.includes(i.id));
  };

  const projekte = store.anfragen.map(a => ({ anfrage: a, status: berechneProjekt(a, interessentenFuer(a.id)) }));
  const gefiltert = projekte.filter(p => filterGesundheit === 'alle' || p.status.gesundheit === filterGesundheit);

  const gruen  = projekte.filter(p => p.status.gesundheit === 'gruen').length;
  const gelb   = projekte.filter(p => p.status.gesundheit === 'gelb').length;
  const rot    = projekte.filter(p => p.status.gesundheit === 'rot').length;
  const erfolge = projekte.filter(p => p.status.kpi.erfolge > 0).length;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, backgroundColor: '#003366', color: 'white', padding: '14px 20px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: '8px' }}>
        <h1 style={{ margin: 0, color: '#003366', fontSize: '24px' }}>Vermittlungsprojekte</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#555' }}>
          Jede Anfrage als Projekt — Klick auf eine Karte öffnet die Details.
        </p>
      </div>

      {/* Übersicht-KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', margin: '24px 0' }}>
        {[
          { label: 'Projekte gesamt', value: projekte.length, color: '#003366', filter: 'alle' as const },
          { label: '🟢 Hohe Aktivität',      value: gruen,   color: '#4CAF50', filter: 'gruen' as const },
          { label: '🟡 Wenig Interesse',      value: gelb,    color: '#FF9900', filter: 'gelb' as const },
          { label: '🔴 Aufmerksamkeit nötig', value: rot,     color: '#f44336', filter: 'rot' as const },
          { label: '⭐ Mit Erfolg',           value: erfolge, color: '#9C27B0', filter: 'alle' as const },
        ].map(stat => (
          <div key={stat.label} onClick={() => setFilterGesundheit(stat.filter)} style={{
            backgroundColor: 'white', padding: '16px', borderRadius: '8px', cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${stat.color}`,
            outline: filterGesundheit === stat.filter && stat.filter !== 'alle' ? `2px solid ${stat.color}` : 'none',
          }}>
            <div style={{ fontSize: '12px', color: '#555' }}>{stat.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: stat.color, marginTop: '4px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {filterGesundheit !== 'alle' && (
        <button onClick={() => setFilterGesundheit('alle')} style={{ marginBottom: '16px', padding: '6px 14px', backgroundColor: 'transparent', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#555' }}>
          ✕ Filter zurücksetzen ({gefiltert.length} angezeigt)
        </button>
      )}

      {/* Projekt-Liste mit Accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {gefiltert.map(({ anfrage: a, status: s }) => {
          const isOpen = offeneIds.has(a.id);
          const projektMatches = store.matchVorschlaege.filter(m => m.anfrageId === a.id);
          const offeneMatches = projektMatches.filter(m => !['abgeschlossen', 'abgelehnt_suchender', 'abgelehnt_interessent'].includes(m.status));
          const wartendeMatches = projektMatches.filter(m => ['freigabe_angefragt', 'suchender_zugestimmt', 'interessent_zugestimmt'].includes(m.status));
          return (
            <div key={a.id} style={{ borderRadius: '10px', overflow: 'hidden', boxShadow: isOpen ? '0 4px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.07)' }}>
              {/* ── Karten-Header (immer sichtbar) ── */}
              <div
                onClick={() => toggleDetail(a.id)}
                style={{
                  backgroundColor: 'white', padding: '18px 20px', cursor: 'pointer',
                  borderLeft: `5px solid ${getGesundheitColor(s.gesundheit)}`,
                  borderBottom: isOpen ? '1px solid #f0f0f0' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span>{getGesundheitEmoji(s.gesundheit)}</span>
                      <span style={{ fontWeight: 700, fontSize: '16px', color: '#003366' }}>{a.ziel}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#444', marginBottom: '8px' }}>
                      {getRichtungLabel(a.richtung)} {a.firmenname} · {a.branche} · {a.anzeigenId}
                    </div>
                    <div style={{ display: 'flex', gap: '18px', fontSize: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Kpi label="Interessenten" value={s.kpi.interessenten} color="#2196F3" />
                      <Kpi label="Freigegeben"   value={s.kpi.freigegeben}   color="#4CAF50" />
                      <Kpi label="Kontakte"       value={s.kpi.kontakte}      color="#9C27B0" />
                      <Kpi label="Erfolge"        value={s.kpi.erfolge}       color="#2e7d32" />
                      {offeneMatches.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', backgroundColor: wartendeMatches.length > 0 ? '#FF990020' : '#2196F320', borderRadius: '10px', fontSize: '11px', fontWeight: 700, color: wartendeMatches.length > 0 ? '#e65100' : '#1565C0' }}>
                          🎯 {offeneMatches.length} Match{offeneMatches.length !== 1 ? 'es' : ''}
                          {wartendeMatches.length > 0 && <span style={{ fontSize: '9px' }}>· {wartendeMatches.length} wartend</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: s.veroeffentlichungColor }}>{s.veroeffentlichung}</span>
                    <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getStatusColor(a.status) }}>{getStatusLabel(a.status)}</span>
                    <span style={{ fontSize: '18px', color: '#555', lineHeight: 1 }}>{isOpen ? '▴' : '▾'}</span>
                  </div>
                </div>
                {s.hinweis && !isOpen && (
                  <div style={{ marginTop: '10px', padding: '6px 10px', backgroundColor: '#fff8e1', borderRadius: '6px', fontSize: '12px', color: '#8a6d00', display: 'flex', gap: '6px' }}>
                    <span>💡</span><span>{s.hinweis}</span>
                  </div>
                )}
              </div>

              {/* ── Aufgeklappte Details (Accordion) ── */}
              {isOpen && (
                <ProjektInhalt
                  anfrage={a}
                  status={s}
                  zuordnungen={store.zuordnungen.filter(z => z.projektId === a.id)}
                  interessenten={interessentenFuer(a.id)}
                  store={store}
                  onToast={zeigeToast}
                />
              )}
            </div>
          );
        })}

        {gefiltert.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#555', fontSize: '14px' }}>
            Keine Projekte gefunden.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROJEKT-INHALT (Accordion-Inhalt) ────────────────────────

function ProjektInhalt({ anfrage: a, status: s, zuordnungen, interessenten, store, onToast }: {
  anfrage: MockAnfrage;
  status: ReturnType<typeof berechneProjekt>;
  zuordnungen: ProjektInteressent[];
  interessenten: typeof MOCK_INTERESSENTEN;
  store: ReturnType<typeof useStore>;
  onToast: (m: string) => void;
}) {
  const [introStatus, setIntroStatus] = useState<Record<string, 'idle'|'sending'|'sent'|'error'>>({});
  const [kontaktSucheOffen, setKontaktSucheOffen] = useState(false);
  const [kontaktSuche, setKontaktSuche] = useState('');
  const matchVorschlaege = store.matchVorschlaege.filter(m => m.anfrageId === a.id);
  const [aktiveTab, setAktiveTab] = useState<'anfrage' | 'marktplatz' | 'matches' | 'social' | 'aktivitaeten'>('anfrage');

  // Zugeordnete Kontakte (dauerhafte Stammdaten)
  const zugeordneteKontakte = store.geschaftskontakte.filter(k =>
    k.projektZuordnungen.some(z => z.projektId === a.id)
  );
  const zugeordneteKontaktIds = zugeordneteKontakte.map(k => k.id);
  const kq = kontaktSuche.trim().toLowerCase();
  const verfuegbareKontakte = store.geschaftskontakte.filter(k =>
    !zugeordneteKontaktIds.includes(k.id) &&
    (!kq || [k.firmenname, k.ansprechpartner, k.email, k.branche, k.region].some(f => f?.toLowerCase().includes(kq)))
  );

  function kontaktHinzufuegen(kontaktId: string) {
    const k = store.geschaftskontakte.find(x => x.id === kontaktId);
    store.addKontaktProjektZuordnung(kontaktId, {
      id: `kpz-${Date.now()}`,
      projektId: a.id,
      status: 'vorgeschlagen',
      notiz: 'Aus Projekt hinzugefügt',
      erstelltAm: new Date().toISOString().split('T')[0],
      erstelltVon: 'Operator',
    });
    onToast(`Kontakt „${k?.firmenname}" hinzugefügt ✓`);
    setKontaktSucheOffen(false);
    setKontaktSuche('');
  }
  async function sendeIntroMail(interessentId: string, i: typeof MOCK_INTERESSENTEN[number]) {
    setIntroStatus(prev => ({ ...prev, [interessentId]: 'sending' }));
    try {
      const res = await fetch('/api/email/intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suchendeEmail: a.email, suchenderName: a.ansprechpartner,
          anfrageFirma: a.firmenname, anfrageAnzeigenId: a.anzeigenId,
          anfrageTelefon: a.telefon || '',
          interessentEmail: i.email, interessentName: i.ansprechpartner,
          interessentFirma: i.firmenname, interessentTelefon: i.telefon || '',
        }),
      });
      setIntroStatus(prev => ({ ...prev, [interessentId]: res.ok ? 'sent' : 'error' }));
      if (res.ok) store.logge(`Intro-Mail: ${i.firmenname} ↔ ${a.firmenname}`, a.anzeigenId, 'status');
    } catch {
      setIntroStatus(prev => ({ ...prev, [interessentId]: 'error' }));
    }
  }

  const ms = a.marktplatzStatus || 'intern';

  return (
    <div style={{ backgroundColor: '#f9fafb', padding: '24px' }}>
      {/* KPI-Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Interessenten', v: s.kpi.interessenten, c: '#2196F3' },
          { label: 'Freigegeben',   v: s.kpi.freigegeben,   c: '#4CAF50' },
          { label: 'Kontakte',      v: s.kpi.kontakte,      c: '#9C27B0' },
          { label: 'Erfolge',       v: s.kpi.erfolge,       c: '#2e7d32' },
          { label: 'Quote',         v: `${s.erfolgsquote}%`, c: '#FF9900' },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: k.c + '12', borderRadius: '8px', padding: '12px', textAlign: 'center', border: `1px solid ${k.c}30` }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {s.hinweis && (
        <div style={{ marginBottom: '20px', padding: '12px 14px', backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', fontSize: '13px', color: '#8a6d00', display: 'flex', gap: '10px' }}>
          <span>💡</span><div><strong>Optimierungsvorschlag:</strong> {s.hinweis}</div>
        </div>
      )}

      {/* ── Tab-Navigation ── */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e0e0e0', marginBottom: '24px', overflowX: 'auto' }}>
        {([
          { key: 'anfrage' as const, label: 'Anfrage', icon: '📋' },
          { key: 'marktplatz' as const, label: 'Marktplatz', icon: '🏪' },
          { key: 'matches' as const, label: 'Matches', icon: '🎯' },
          { key: 'social' as const, label: 'Social Media', icon: '📣' },
          { key: 'aktivitaeten' as const, label: 'Aktivitäten', icon: '📊' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setAktiveTab(tab.key)} style={{
            padding: '10px 20px', fontSize: '13px', fontWeight: aktiveTab === tab.key ? 700 : 500, cursor: 'pointer',
            border: 'none', borderBottom: aktiveTab === tab.key ? '3px solid #003366' : '3px solid transparent',
            backgroundColor: aktiveTab === tab.key ? '#f0f4ff' : 'transparent',
            color: aktiveTab === tab.key ? '#003366' : '#555',
            marginBottom: '-2px', whiteSpace: 'nowrap' as const,
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
          }}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ── REITER: ANFRAGE ── */}
      {aktiveTab === 'anfrage' && (
      <Section titel="Anfragebeschreibung">
        <p style={{ fontSize: '13px', color: '#444', lineHeight: 1.6, margin: '0 0 10px 0' }}>{a.beschreibung}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: '#222' }}>
          <div><span style={{ color: '#555', fontWeight: 500 }}>Region:</span> {getLandFlag(a.standort.includes('Dänemark') ? 'daenemark' : 'deutschland')} {a.standort}</div>
          <div><span style={{ color: '#555', fontWeight: 500 }}>Branche:</span> {a.branche}</div>
          <div><span style={{ color: '#555', fontWeight: 500 }}>Art:</span> {a.art}</div>
          <div><span style={{ color: '#555', fontWeight: 500 }}>Sichtbarkeit:</span> {a.sichtbarkeit}</div>
        </div>
        <a href="/dashboard/anfragen" style={{ fontSize: '12px', color: '#003366', fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: '8px' }}>→ Anfrage bearbeiten</a>
      </Section>
      )}

      {/* ── REITER: MATCHES ── */}
      {aktiveTab === 'matches' && (<>
      <Section titel={`Interessenten (${zuordnungen.length})`}>
        {zuordnungen.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>Noch keine Interessenten. {matchVorschlaege.length > 0 && 'Es gibt Match-Vorschläge (siehe unten).'}</p>
        ) : (
          zuordnungen.map((z: ProjektInteressent) => {
            const i = MOCK_INTERESSENTEN.find(x => x.id === z.interessentId);
            if (!i) return null;
            const istatus = introStatus[i.id] || 'idle';
            const kannIntro = ['freigegeben', 'kontakt_hergestellt'].includes(z.status);
            return (
              <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #e8e8e8', fontSize: '13px' }}>
                <div style={{ flex: 1 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#003366' }}>{i.firmenname}</span>
                    <span style={{ color: '#444' }}> · {i.ansprechpartner}</span>
                    <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 700, backgroundColor: z.zuordnungsart === 'manuell' ? '#FF990020' : '#99999920', color: z.zuordnungsart === 'manuell' ? '#e65100' : '#777' }}>
                      {z.zuordnungsart === 'manuell' ? '✋ manuell' : '⚙ auto'}
                    </span>
                  </div>
                  {kannIntro && (
                    <div style={{ marginTop: '5px' }}>
                      {istatus === 'idle'    && <button onClick={() => sendeIntroMail(i.id, i)} style={{ padding: '4px 10px', backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', color: '#2e7d32', fontWeight: 600 }}>✉️ Intro-Mail senden</button>}
                      {istatus === 'sending' && <span style={{ fontSize: '11px', color: '#555' }}>⏳ Wird gesendet…</span>}
                      {istatus === 'sent'    && <span style={{ fontSize: '11px', color: '#4CAF50', fontWeight: 600 }}>✅ Intro-Mail gesendet</span>}
                      {istatus === 'error'   && <span style={{ fontSize: '11px', color: '#f44336' }}>❌ Fehler — API-Key prüfen</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {i.matchScore && <span style={{ fontSize: '12px', fontWeight: 700, color: i.matchScore >= 80 ? '#4CAF50' : '#FF9900' }}>{i.matchScore}%</span>}
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getZuordnungColor(z.status) }}>{getZuordnungLabel(z.status)}</span>
                </div>
              </div>
            );
          })
        )}
        <a href="/dashboard/interessenten" style={{ fontSize: '12px', color: '#003366', fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: '8px' }}>→ Interessenten verwalten</a>
        <div style={{ fontSize: '11px', color: '#555', marginTop: '6px', fontStyle: 'italic' }}>
          ℹ️ Eingangskorb — neue Interessensbekundungen vom Marktplatz. Nach Prüfung „Kontakt erstellen".
        </div>
      </Section>

      {/* 2b. Zugeordnete Kontakte (dauerhafte Stammdaten) */}
      <Section titel={`Zugeordnete Kontakte (${zugeordneteKontakte.length})`}>
        {zugeordneteKontakte.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#555', margin: '0 0 10px 0' }}>Noch keine dauerhaften Kontakte zugeordnet.</p>
        ) : (
          zugeordneteKontakte.map(k => {
            const z = k.projektZuordnungen.find(zz => zz.projektId === a.id)!;
            return (
              <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e8e8e8', fontSize: '13px' }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#003366' }}>{k.firmenname}</span>
                  <span style={{ color: '#444' }}> · {k.ansprechpartner}</span>
                  {k.region && <span style={{ color: '#444', fontSize: '11px' }}> · {k.region}</span>}
                  {z.notiz && <div style={{ fontSize: '11px', color: '#555', fontStyle: 'italic', marginTop: '2px' }}>„{z.notiz}"</div>}
                </div>
                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getKontaktZuordnungColor(z.status), flexShrink: 0 }}>
                  {getKontaktZuordnungLabel(z.status)}
                </span>
              </div>
            );
          })
        )}

        {!kontaktSucheOffen ? (
          <button onClick={() => setKontaktSucheOffen(true)} style={{ marginTop: '10px', padding: '7px 14px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            + Kontakt hinzufügen
          </button>
        ) : (
          <div style={{ marginTop: '12px', padding: '14px', backgroundColor: '#f0f4ff', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#003366' }}>Bestehenden Kontakt suchen</div>
              <a href="/dashboard/kontakte" style={{ fontSize: '11px', color: '#003366', fontWeight: 600, textDecoration: 'none' }}>+ Neuen Kontakt anlegen →</a>
            </div>
            <input value={kontaktSuche} onChange={e => setKontaktSuche(e.target.value)} placeholder="Name, Firma, Branche, Region, E-Mail…" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {verfuegbareKontakte.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>Keine passenden Kontakte. Lege im Kontakte-Modul einen neuen an.</p>
              ) : verfuegbareKontakte.slice(0, 8).map(k => (
                <button key={k.id} onClick={() => kontaktHinzufuegen(k.id)} style={{ textAlign: 'left', padding: '8px 10px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#003366' }}>{k.firmenname}</div>
                  <div style={{ fontSize: '11px', color: '#555' }}>{k.ansprechpartner} · {k.email}{k.region ? ` · ${k.region}` : ''}</div>
                </button>
              ))}
            </div>
            <button onClick={() => { setKontaktSucheOffen(false); setKontaktSuche(''); }} style={{ marginTop: '8px', padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#555' }}>
              Schließen
            </button>
          </div>
        )}
      </Section>

      <MatchSektion anfrage={a} matchVorschlaege={matchVorschlaege} store={store} onToast={onToast} />
      </>)}

      {/* ── REITER: AKTIVITÄTEN ── */}
      {aktiveTab === 'aktivitaeten' && (<>
      <Section titel="Verlauf & nächste Aufgabe">
        <div style={{ fontSize: '13px', color: '#444' }}>
          <div style={{ marginBottom: '6px' }}>📅 Erstellt: {a.createdAt}</div>
          <div style={{ marginBottom: '6px' }}>📊 Letzte Aktivität: {interessenten[0]?.createdAt || a.createdAt}</div>
          <div style={{ padding: '8px 12px', backgroundColor: '#f0f4ff', borderRadius: '6px', marginTop: '8px' }}>
            <strong>Nächste Aufgabe:</strong> {naechsteAufgabe(s, interessenten.length, a.workflowStatus)}
          </div>
        </div>
      </Section>
      <AktivitaetenTab anfrage={a} status={s} interessenten={interessenten} store={store} matchVorschlaege={matchVorschlaege} />
      </>)}

      {/* ── REITER: MARKTPLATZ ── */}
      {aktiveTab === 'marktplatz' && (<>
      <MarktplatzSektion anfrage={a} store={store} onToast={onToast} />

      <FormularSektion anfrage={a} store={store} onToast={onToast} />
      </>)}

      {/* ── REITER: ANFRAGE (Fortsetzung) ── */}
      {aktiveTab === 'anfrage' && (<>
      <Section titel="Von Easy-B2B geklärte Punkte">
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
      </Section>

      <MarktplatzReichinhalt anfrage={a} store={store} onToast={onToast} />
      </>)}

      {/* ── REITER: SOCIAL MEDIA ── */}
      {aktiveTab === 'social' && (
        <SocialMediaTab anfrage={a} store={store} onToast={onToast} />
      )}
    </div>
  );
}

// ─── SOCIAL MEDIA TAB ─────────────────────────────────────────

function SocialMediaTab({ anfrage: a, store, onToast }: {
  anfrage: MockAnfrage;
  store: ReturnType<typeof useStore>;
  onToast: (m: string) => void;
}) {
  const [plattform, setPlattform] = useState<'linkedin' | 'facebook' | 'instagram'>('linkedin');
  const [generating, setGenerating] = useState(false);
  const [beitrag, setBeitrag] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [gespeichert, setGespeichert] = useState<Record<string, { text: string; hashtags: string }>>({});

  const META = {
    linkedin: { label: 'LinkedIn', icon: '💼', maxLen: 3000, tip: 'Professionell, B2B-Ton, Suchmaschinen-relevant' },
    facebook: { label: 'Facebook', icon: '📘', maxLen: 2000, tip: 'Lockerer Ton, Community-ansprechend, mit Fragen' },
    instagram: { label: 'Instagram', icon: '📸', maxLen: 2200, tip: 'Kurz, visuell, Emoji-freundlich, viele Hashtags' },
  };

  function generiere() {
    setGenerating(true);
    setTimeout(() => {
      const texte: Record<string, string> = {
        linkedin: `🤝 Neues Projekt auf dem Easy-B2B Marktplatz!\n\n${a.firmenname} aus ${a.standort} sucht ${a.ziel.toLowerCase()}.\n\n${a.beschreibung.slice(0, 300)}\n\nSie kennen jemanden, der passen könnte? Leiten Sie diesen Beitrag gerne weiter.\n\n👉 Mehr erfahren auf easy-b2b.de`,
        facebook: `🇩🇰🇩🇪 Deutsch-dänische Geschäftsbeziehungen stärken!\n\n${a.firmenname} sucht ${a.ziel.toLowerCase()} — ein spannendes Projekt auf unserem Easy-B2B Marktplatz.\n\n${a.beschreibung.slice(0, 200)}\n\nKennen Sie den richtigen Ansprechpartner? Teilen Sie diesen Beitrag! 🤝\n\n🔗 easy-b2b.de`,
        instagram: `🤝 Neues auf dem Marktplatz!\n\n${a.ziel} — ${a.beschreibung.slice(0, 150)}…\n\n📍 ${a.standort}\n🏢 ${a.branche}\n\nLink in Bio 👆`,
      };
      const hashtagSets: Record<string, string> = {
        linkedin: `#B2B #DeutschDänisch #Matchmaking #${a.branche.replace(/\s/g, '')} #EasyB2B #Geschäftspartner`,
        facebook: `#EasyB2B #DeutschDänisch #B2B #${a.branche.replace(/\s/g, '')} #Matchmaking #Business`,
        instagram: `#EasyB2B #B2B #DeutschDänisch #Matchmaking #Business #${a.branche.replace(/\s/g, '')} #Vertriebspartner #Export #Import`,
      };
      setBeitrag(texte[plattform]);
      setHashtags(hashtagSets[plattform]);
      setGenerating(false);
    }, 1200);
  }

  function kopiere() {
    const text = beitrag + (hashtags ? '\n\n' + hashtags : '');
    navigator.clipboard.writeText(text).then(() => onToast('In die Zwischenablage kopiert ✓'));
  }

  function speichere() {
    setGespeichert(prev => ({ ...prev, [plattform]: { text: beitrag, hashtags } }));
    store.logge(`Social-Media-Beitrag gespeichert: ${META[plattform].label}`, a.anzeigenId, 'bearbeiten');
    onToast(`${META[plattform].label}-Beitrag gespeichert ✓`);
  }

  return (
    <div>
      <Section titel="Beiträge erstellen">
        <p style={{ fontSize: '12px', color: '#555', margin: '0 0 16px 0' }}>
          Social-Media-Beiträge generieren, um das Projekt außerhalb des Marktplatzes zu verbreiten.
          Die KI erstellt einen Vorschlag basierend auf den Projektdaten.
        </p>

        {/* Plattform-Auswahl */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          {(['linkedin', 'facebook', 'instagram'] as const).map(p => {
            const m = META[p];
            const saved = gespeichert[p];
            return (
              <button key={p} onClick={() => { setPlattform(p); if (saved) { setBeitrag(saved.text); setHashtags(saved.hashtags); } else if (plattform !== p) { setBeitrag(''); setHashtags(''); } }} style={{
                flex: 1, padding: '14px 10px', borderRadius: '10px', cursor: 'pointer',
                border: plattform === p ? '2px solid #003366' : '1px solid #ddd',
                backgroundColor: plattform === p ? '#f0f4ff' : 'white',
                textAlign: 'center', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>{m.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: plattform === p ? 700 : 500, color: plattform === p ? '#003366' : '#555' }}>{m.label}</div>
                {saved && <div style={{ fontSize: '10px', color: '#4CAF50', marginTop: '3px', fontWeight: 600 }}>✓ Gespeichert</div>}
              </button>
            );
          })}
        </div>

        {/* Tipp */}
        <div style={{ padding: '10px 14px', backgroundColor: '#f0f4ff', borderRadius: '8px', fontSize: '12px', color: '#003366', marginBottom: '16px' }}>
          💡 <strong>Tipp für {META[plattform].label}:</strong> {META[plattform].tip}
        </div>

        {/* Generieren-Button */}
        {!beitrag && (
          <div style={{ textAlign: 'center', padding: '30px', border: '2px dashed #d0ddf0', borderRadius: '10px', backgroundColor: '#fafbff' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{META[plattform].icon}</div>
            <button onClick={generiere} disabled={generating} style={{
              padding: '10px 28px', backgroundColor: '#003366', color: 'white', border: 'none',
              borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
              opacity: generating ? 0.7 : 1,
            }}>
              {generating ? '⏳ KI generiert…' : `✨ ${META[plattform].label}-Beitrag erstellen`}
            </button>
          </div>
        )}

        {/* Beitrag Editor */}
        {beitrag && (
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#003366', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Beitragstext</label>
            <textarea
              value={beitrag}
              onChange={e => setBeitrag(e.target.value)}
              style={{ width: '100%', minHeight: '200px', padding: '14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px', fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', marginTop: '4px' }}>
              <span>{beitrag.length} / {META[plattform].maxLen} Zeichen</span>
              {beitrag.length > META[plattform].maxLen && <span style={{ color: '#c62828', fontWeight: 600 }}>⚠ Zu lang!</span>}
            </div>

            <div style={{ marginTop: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#003366', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hashtags</label>
              <input
                value={hashtags}
                onChange={e => setHashtags(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            {/* Vorschau */}
            <div style={{ marginTop: '14px', padding: '14px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vorschau</div>
              <div style={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{beitrag}</div>
              {hashtags && <div style={{ fontSize: '12px', color: '#1565C0', marginTop: '10px' }}>{hashtags}</div>}
            </div>

            {/* Aktionen */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button onClick={kopiere} style={{ padding: '8px 18px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                📋 Kopieren
              </button>
              <button onClick={speichere} style={{ padding: '8px 18px', backgroundColor: '#e8f5e9', color: '#1b5e20', border: '1px solid #a5d6a7', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                💾 Speichern
              </button>
              <button onClick={generiere} disabled={generating} style={{ padding: '8px 18px', backgroundColor: '#f5f5f5', color: '#555', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: generating ? 'wait' : 'pointer' }}>
                🔄 Neu generieren
              </button>
              <button onClick={() => { setBeitrag(''); setHashtags(''); }} style={{ padding: '8px 18px', backgroundColor: 'transparent', color: '#555', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                ✕ Verwerfen
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Gespeicherte Beiträge */}
      {Object.keys(gespeichert).length > 0 && (
        <Section titel="Gespeicherte Beiträge">
          {Object.entries(gespeichert).map(([key, val]) => (
            <div key={key} style={{ padding: '12px 14px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e8e8e8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#003366' }}>{META[key as keyof typeof META]?.icon} {META[key as keyof typeof META]?.label}</span>
                <button onClick={() => { navigator.clipboard.writeText(val.text + (val.hashtags ? '\n\n' + val.hashtags : '')); onToast('Kopiert ✓'); }} style={{ padding: '4px 12px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, color: '#003366' }}>📋 Kopieren</button>
              </div>
              <div style={{ fontSize: '12px', color: '#555', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{val.text.slice(0, 200)}{val.text.length > 200 ? '…' : ''}</div>
            </div>
          ))}
        </Section>
      )}

      {/* Zukunfts-Hinweis */}
      <div style={{ padding: '16px', backgroundColor: '#f0f4ff', borderRadius: '10px', border: '1px dashed #90caf9' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#003366', marginBottom: '6px' }}>🔮 Zukünftig geplant</div>
        <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.6 }}>
          Direkte Veröffentlichung über API-Anbindung an LinkedIn, Facebook und Instagram.
          Aktuell: Beitrag erstellen → kopieren → manuell in der jeweiligen Plattform posten.
        </div>
      </div>
    </div>
  );
}

// ─── AKTIVITÄTEN TAB ──────────────────────────────────────────

function AktivitaetenTab({ anfrage: a, status: s, interessenten, store, matchVorschlaege }: {
  anfrage: MockAnfrage;
  status: ReturnType<typeof berechneProjekt>;
  interessenten: typeof MOCK_INTERESSENTEN;
  store: ReturnType<typeof useStore>;
  matchVorschlaege: MatchVorschlag[];
}) {
  const logs = store.aktivitaeten.filter(l =>
    l.bezug === a.anzeigenId || l.bezug === a.id || l.bezug === a.firmenname
  );

  return (
    <div>
      {/* Projekt-Zeitlinie */}
      <Section titel="Projekt-Zeitlinie">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {[
            { icon: '📅', color: '#003366', label: 'Projekt erstellt', datum: a.createdAt, show: true },
            { icon: '🚀', color: '#2e7d32', label: 'Veröffentlicht', datum: a.veroeffentlichtAm, show: !!a.veroeffentlichtAm },
            { icon: '👥', color: '#2196F3', label: 'Erster Interessent', datum: interessenten[0]?.createdAt, show: interessenten.length > 0 },
            { icon: '🎯', color: '#FF9900', label: 'Erster Match-Vorschlag', datum: matchVorschlaege[0]?.erstelltAm, show: matchVorschlaege.length > 0 },
            { icon: '📊', color: '#9C27B0', label: 'Letzte Aktivität', datum: logs.length > 0 ? logs[logs.length - 1].zeit.split('T')[0] : a.createdAt, show: true },
          ].filter(e => e.show).map((evt, i, arr) => (
            <div key={evt.label} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: evt.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>{evt.icon}</span>
                {i < arr.length - 1 && <div style={{ width: '2px', height: '24px', backgroundColor: '#e0e0e0' }} />}
              </div>
              <div style={{ paddingTop: '4px', paddingBottom: i < arr.length - 1 ? '12px' : '0' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>{evt.label}</div>
                <div style={{ fontSize: '11px', color: '#555' }}>{evt.datum || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Statistiken */}
      <Section titel="Projekt-Statistiken">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            { label: 'Interessenten gesamt', value: interessenten.length, icon: '👥', color: '#2196F3' },
            { label: 'Match-Vorschläge', value: matchVorschlaege.length, icon: '🎯', color: '#FF9900' },
            { label: 'Aktive Matches', value: matchVorschlaege.filter(m => !['abgelehnt_suchender', 'abgelehnt_interessent', 'abgeschlossen'].includes(m.status)).length, icon: '🤝', color: '#003366' },
            { label: 'Abgeschlossen', value: matchVorschlaege.filter(m => m.status === 'abgeschlossen').length, icon: '⭐', color: '#2e7d32' },
            { label: 'Abgelehnt', value: matchVorschlaege.filter(m => m.status.startsWith('abgelehnt')).length, icon: '❌', color: '#c62828' },
            { label: 'Erfolgsquote', value: `${s.erfolgsquote}%`, icon: '📈', color: '#9C27B0' },
          ].map(stat => (
            <div key={stat.label} style={{ padding: '12px', backgroundColor: stat.color + '08', borderRadius: '8px', textAlign: 'center', border: `1px solid ${stat.color}20` }}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>{stat.icon}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Aktivitätsprotokoll */}
      <Section titel="Aktivitätsprotokoll">
        {logs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', border: '2px dashed #e0e0e0', borderRadius: '8px' }}>
            <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>
              Noch keine protokollierten Aktivitäten für dieses Projekt.
            </p>
            <p style={{ fontSize: '11px', color: '#555', margin: '6px 0 0 0' }}>
              Aktivitäten werden automatisch beim Bearbeiten, Veröffentlichen und Matchen protokolliert.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflowY: 'auto' }}>
            {logs.slice().reverse().map((log, i) => (
              <div key={log.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 12px', backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white', borderRadius: '6px', fontSize: '12px' }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>
                  {log.typ === 'status' ? '🔄' : log.typ === 'anlegen' ? '✨' : '✏️'}
                </span>
                <span style={{ color: '#555', flexShrink: 0, fontSize: '11px', minWidth: '70px' }}>
                  {log.zeit.split('T')[0]}
                </span>
                <span style={{ color: '#333', flex: 1 }}>{log.was}</span>
                <span style={{ padding: '2px 8px', backgroundColor: log.typ === 'status' ? '#e3f2fd' : log.typ === 'anlegen' ? '#e8f5e9' : '#fff3e0', borderRadius: '8px', fontSize: '9px', fontWeight: 600, color: log.typ === 'status' ? '#1565C0' : log.typ === 'anlegen' ? '#2e7d32' : '#e65100', flexShrink: 0 }}>
                  {log.typ === 'status' ? 'Status' : log.typ === 'anlegen' ? 'Neu' : 'Bearbeitet'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── MATCH-SEKTION (DSGVO-konformer Freigabeprozess) ─────────

function MatchSektion({ anfrage: a, matchVorschlaege, store, onToast }: {
  anfrage: MockAnfrage;
  matchVorschlaege: MatchVorschlag[];
  store: ReturnType<typeof useStore>;
  onToast: (m: string) => void;
}) {
  const [sendStatus, setSendStatus] = useState<Record<string, 'idle'|'sending'|'sent'|'error'>>({});
  const [paketStatus, setPaketStatus] = useState<Record<string, 'idle'|'sending'|'sent'|'error'>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const aktive = matchVorschlaege.filter(m => !['abgelehnt_suchender', 'abgelehnt_interessent'].includes(m.status));
  const abgelehnte = matchVorschlaege.filter(m => ['abgelehnt_suchender', 'abgelehnt_interessent'].includes(m.status));
  const wartenAufConsent = matchVorschlaege.filter(m => ['freigabe_angefragt', 'suchender_zugestimmt', 'interessent_zugestimmt'].includes(m.status));

  async function sendeFreigabeAnfrage(match: MatchVorschlag) {
    setSendStatus(prev => ({ ...prev, [match.id]: 'sending' }));
    const interessent = MOCK_INTERESSENTEN.find(i => i.id === match.interessentId);
    try {
      const res = await fetch('/api/email/match-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typ: 'freigabe_anfragen',
          suchendeEmail: a.email,
          suchenderName: a.ansprechpartner,
          anfrageFirma: a.firmenname,
          anfrageAnzeigenId: a.anzeigenId,
          anfrageBranche: a.branche,
          anfrageRegion: a.standort,
          anfrageSprachen: a.sprachen,
          interessentEmail: interessent?.email || '',
          interessentName: interessent?.ansprechpartner || '',
          interessentFirma: match.interessentFirma,
          interessentBranche: match.anfrageBranche || '',
          interessentRegion: interessent?.region || '',
          interessentSprachen: interessent?.sprachen || [],
          matchGruende: match.gruende,
          matchScore: match.score,
        }),
      });
      if (res.ok) {
        store.setzeMatchStatus(match.id, 'freigabe_angefragt');
        setSendStatus(prev => ({ ...prev, [match.id]: 'sent' }));
        onToast('Freigabe-Anfragen an beide Parteien gesendet ✓');
      } else {
        setSendStatus(prev => ({ ...prev, [match.id]: 'error' }));
      }
    } catch {
      setSendStatus(prev => ({ ...prev, [match.id]: 'error' }));
    }
  }

  async function sendeMatchPaket(match: MatchVorschlag) {
    setPaketStatus(prev => ({ ...prev, [match.id]: 'sending' }));
    const interessent = MOCK_INTERESSENTEN.find(i => i.id === match.interessentId);
    try {
      const res = await fetch('/api/email/match-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typ: 'match_paket',
          suchendeEmail: a.email,
          suchenderName: a.ansprechpartner,
          anfrageFirma: a.firmenname,
          anfrageTelefon: a.telefon,
          anfrageWebsite: '',
          anfrageSprachen: a.sprachen,
          interessentEmail: interessent?.email || '',
          interessentName: interessent?.ansprechpartner || '',
          interessentFirma: match.interessentFirma,
          interessentTelefon: interessent?.telefon || '',
          interessentWebsite: interessent?.website || '',
          interessentLinkedin: interessent?.linkedin || '',
          interessentSprachen: interessent?.sprachen || [],
          empfohlenerErstkontakt: 'suchender',
          empfohleneSprache: interessent?.bevorzugteSprache === 'daenisch' ? 'Dänisch / Englisch' : 'Deutsch',
          projektziel: a.ziel,
          hinweise: [
            'Nennen Sie Easy-B2B als gemeinsamen Kontext.',
            'Empfehlen Sie ein erstes kurzes Kennenlerngespräch (30 Min.).',
            'Halten Sie Ihre Produktunterlagen bereit.',
          ],
        }),
      });
      if (res.ok) {
        store.updateMatchVorschlag(match.id, {
          status: 'kontaktdaten_freigegeben',
          matchPaket: {
            erstelltAm: new Date().toISOString().split('T')[0],
            versendetAm: new Date().toISOString().split('T')[0],
            empfohlenerErstkontakt: 'suchender',
            empfohleneSprache: interessent?.bevorzugteSprache === 'daenisch' ? 'Dänisch / Englisch' : 'Deutsch',
            hinweise: ['Easy-B2B als Kontext nennen', 'Erstes Kennenlerngespräch empfohlen'],
          },
        });
        setPaketStatus(prev => ({ ...prev, [match.id]: 'sent' }));
        onToast('Match-Paket an beide Parteien gesendet ✓');
      } else {
        setPaketStatus(prev => ({ ...prev, [match.id]: 'error' }));
      }
    } catch {
      setPaketStatus(prev => ({ ...prev, [match.id]: 'error' }));
    }
  }

  // Operator simuliert Zustimmung (in Produktion kommt das per E-Mail-Link)
  function simuliereZustimmung(matchId: string, partei: 'suchender' | 'interessent') {
    const match = matchVorschlaege.find(m => m.id === matchId);
    if (!match) return;
    const firma = partei === 'suchender' ? a.firmenname : match.interessentFirma;
    const person = partei === 'suchender' ? a.ansprechpartner : (MOCK_INTERESSENTEN.find(i => i.id === match.interessentId)?.ansprechpartner || '');
    store.dokumentiereZustimmung(matchId, partei, {
      zeitpunkt: new Date().toISOString(),
      person,
      unternehmen: firma,
    });
    onToast(`DSGVO-Zustimmung dokumentiert: ${firma} ✓`);
  }

  function simuliereAblehnung(matchId: string, partei: 'suchender' | 'interessent') {
    store.dokumentiereAblehnung(matchId, partei, 'Kein Interesse zum jetzigen Zeitpunkt');
    onToast(`Ablehnung dokumentiert ✓`);
  }

  return (
    <Section titel={`Match-Vorschläge & Freigabeprozess (${aktive.length})`}>
      {matchVorschlaege.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', border: '2px dashed #e0e0e0', borderRadius: '8px' }}>
          <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>
            Noch keine Match-Vorschläge für dieses Projekt.
          </p>
          <p style={{ fontSize: '11px', color: '#555', margin: '6px 0 0 0' }}>
            Match-Vorschläge entstehen aus geprüften Interessenten und Kontakten.
          </p>
        </div>
      ) : (
        <div>
          {/* Info-Box bei wartenden Consents */}
          {wartenAufConsent.length > 0 && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', fontSize: '12px', color: '#8a6d00', display: 'flex', gap: '8px' }}>
              <span>📩</span>
              <span><strong>{wartenAufConsent.length} Match{wartenAufConsent.length !== 1 ? 'es' : ''}</strong> warten auf DSGVO-Zustimmung beider Parteien.</span>
            </div>
          )}

          {/* Aktive Matches */}
          {aktive.map(match => {
            const isExpanded = expanded === match.id;
            const interessent = MOCK_INTERESSENTEN.find(i => i.id === match.interessentId);
            const ss = sendStatus[match.id] || 'idle';
            const ps = paketStatus[match.id] || 'idle';
            return (
              <div key={match.id} style={{ marginBottom: '10px', borderRadius: '8px', border: '1px solid #e0e0e0', overflow: 'hidden', backgroundColor: 'white' }}>
                {/* Match-Zeile */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : match.id)}
                  style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '14px' }}>{getMatchStatusIcon(match.status)}</span>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#003366' }}>{match.interessentFirma}</span>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: match.score >= 80 ? '#4CAF50' : '#FF9900' }}>{match.score}%</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#444' }}>
                      {interessent?.ansprechpartner} · {interessent?.region || 'Region unbekannt'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getMatchStatusColor(match.status) }}>
                      {getMatchStatusLabel(match.status)}
                    </span>
                    <span style={{ fontSize: '14px', color: '#555' }}>{isExpanded ? '▴' : '▾'}</span>
                  </div>
                </div>

                {/* Aufgeklappte Details */}
                {isExpanded && (
                  <div style={{ padding: '0 14px 14px 14px', borderTop: '1px solid #f0f0f0' }}>
                    {/* Match-Gründe */}
                    <div style={{ margin: '12px 0', padding: '10px 12px', backgroundColor: '#f0f7ff', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#003366', marginBottom: '6px' }}>Warum passt dieser Kontakt?</div>
                      {match.gruende.map((g, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', fontSize: '12px', color: '#333', padding: '2px 0' }}>
                          <span style={{ color: '#4CAF50', flexShrink: 0 }}>✓</span><span>{g}</span>
                        </div>
                      ))}
                      {match.risiken && match.risiken.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#e65100', marginBottom: '4px' }}>Risiken / Zu klären</div>
                          {match.risiken.map((r, i) => (
                            <div key={i} style={{ display: 'flex', gap: '6px', fontSize: '12px', color: '#444', padding: '2px 0' }}>
                              <span style={{ color: '#FF9900', flexShrink: 0 }}>⚠</span><span>{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── STATUS-SPEZIFISCHE AKTIONEN ──────────────── */}

                    {/* Vorschlag erstellt → "Match vorschlagen" (Consent starten) */}
                    {match.status === 'vorschlag_erstellt' && (
                      <div style={{ padding: '12px', backgroundColor: '#f0f4ff', borderRadius: '8px', marginBottom: '10px' }}>
                        <p style={{ fontSize: '12px', color: '#003366', margin: '0 0 10px 0', fontWeight: 600 }}>
                          Freigabeprozess starten? Beide Parteien erhalten eine E-Mail mit Match-Details — <strong>ohne Kontaktdaten</strong>.
                        </p>

                        {/* Transparenz: Was wird gesendet? */}
                        <div style={{ margin: '10px 0', padding: '10px 12px', backgroundColor: '#e8f5e9', borderRadius: '6px', border: '1px solid #c8e6c9' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#2e7d32', marginBottom: '6px' }}>📧 Diese E-Mails werden versendet:</div>
                          <div style={{ fontSize: '11px', color: '#1b5e20', lineHeight: 1.7 }}>
                            <div>1️⃣ <strong>An {a.firmenname}</strong> (Suchender): Match-Vorschlag mit anonymisiertem Interessenten-Profil</div>
                            <div>2️⃣ <strong>An Interessent</strong>: Match-Vorschlag mit Projekt-Übersicht</div>
                          </div>
                          <div style={{ fontSize: '10px', color: '#388e3c', marginTop: '6px' }}>
                            💡 Vorlagen bearbeiten unter: Formulare → 🎯 Matchmaking-Vorlagen
                          </div>
                        </div>

                        {ss === 'idle' && <button onClick={() => sendeFreigabeAnfrage(match)} style={{ padding: '8px 16px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>🎯 Match vorschlagen & Freigabe anfragen</button>}
                        {ss === 'sending' && <span style={{ fontSize: '12px', color: '#555' }}>⏳ Mails werden gesendet…</span>}
                        {ss === 'sent' && <span style={{ fontSize: '12px', color: '#4CAF50', fontWeight: 600 }}>✅ Freigabe-Anfragen gesendet</span>}
                        {ss === 'error' && <span style={{ fontSize: '12px', color: '#f44336' }}>❌ Fehler — API-Key prüfen</span>}
                      </div>
                    )}

                    {/* Freigabe angefragt → DSGVO-Consent-Status */}
                    {['freigabe_angefragt', 'suchender_zugestimmt', 'interessent_zugestimmt'].includes(match.status) && (
                      <div style={{ padding: '14px', backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#5d4037', marginBottom: '12px' }}>📩 DSGVO-Zustimmung ausstehend</div>

                        {/* Suchender */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'white', borderRadius: '6px', marginBottom: '6px', border: '1px solid #e8e8e8' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#003366' }}>📋 {a.firmenname} <span style={{ color: '#555', fontWeight: 400 }}>(Suchender)</span></div>
                            {match.zustimmungSuchender ? (
                              <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '2px' }}>
                                ✅ Zugestimmt am {new Date(match.zustimmungSuchender.zeitpunkt).toLocaleDateString('de-DE')} um {new Date(match.zustimmungSuchender.zeitpunkt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#FF9900', marginTop: '2px' }}>⏳ Ausstehend</div>
                            )}
                          </div>
                          {!match.zustimmungSuchender && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => simuliereZustimmung(match.id, 'suchender')} style={{ padding: '4px 10px', backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, color: '#2e7d32' }}>✅ Zustimmung</button>
                              <button onClick={() => simuliereAblehnung(match.id, 'suchender')} style={{ padding: '4px 10px', backgroundColor: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, color: '#c62828' }}>❌</button>
                            </div>
                          )}
                        </div>

                        {/* Interessent */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e8e8e8' }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#003366' }}>👥 {match.interessentFirma} <span style={{ color: '#555', fontWeight: 400 }}>(Interessent)</span></div>
                            {match.zustimmungInteressent ? (
                              <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '2px' }}>
                                ✅ Zugestimmt am {new Date(match.zustimmungInteressent.zeitpunkt).toLocaleDateString('de-DE')} um {new Date(match.zustimmungInteressent.zeitpunkt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#FF9900', marginTop: '2px' }}>⏳ Ausstehend</div>
                            )}
                          </div>
                          {!match.zustimmungInteressent && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => simuliereZustimmung(match.id, 'interessent')} style={{ padding: '4px 10px', backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, color: '#2e7d32' }}>✅ Zustimmung</button>
                              <button onClick={() => simuliereAblehnung(match.id, 'interessent')} style={{ padding: '4px 10px', backgroundColor: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, color: '#c62828' }}>❌</button>
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: '10px', color: '#555', marginTop: '8px', fontStyle: 'italic' }}>
                          💡 In Produktion kommen Zustimmungen per E-Mail-Link. Hier können sie manuell dokumentiert werden.
                        </div>
                      </div>
                    )}

                    {/* Beide zugestimmt → Match-Paket senden */}
                    {match.status === 'beide_zugestimmt' && (
                      <div style={{ padding: '14px', backgroundColor: '#e8f5e9', border: '2px solid #4CAF50', borderRadius: '8px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1b5e20', marginBottom: '10px' }}>✅ Beide Parteien haben zugestimmt!</div>

                        {/* DSGVO-Dokumentation */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                          {match.zustimmungSuchender && (
                            <div style={{ padding: '8px 10px', backgroundColor: 'white', borderRadius: '6px', fontSize: '11px' }}>
                              <div style={{ fontWeight: 600, color: '#003366' }}>{match.zustimmungSuchender.unternehmen}</div>
                              <div style={{ color: '#444' }}>Zustimmung: {new Date(match.zustimmungSuchender.zeitpunkt).toLocaleDateString('de-DE')}</div>
                              <div style={{ color: '#444' }}>{new Date(match.zustimmungSuchender.zeitpunkt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div>
                              <div style={{ color: '#444' }}>Person: {match.zustimmungSuchender.person}</div>
                            </div>
                          )}
                          {match.zustimmungInteressent && (
                            <div style={{ padding: '8px 10px', backgroundColor: 'white', borderRadius: '6px', fontSize: '11px' }}>
                              <div style={{ fontWeight: 600, color: '#003366' }}>{match.zustimmungInteressent.unternehmen}</div>
                              <div style={{ color: '#444' }}>Zustimmung: {new Date(match.zustimmungInteressent.zeitpunkt).toLocaleDateString('de-DE')}</div>
                              <div style={{ color: '#444' }}>{new Date(match.zustimmungInteressent.zeitpunkt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div>
                              <div style={{ color: '#444' }}>Person: {match.zustimmungInteressent.person}</div>
                            </div>
                          )}
                        </div>

                        <p style={{ fontSize: '12px', color: '#2e7d32', margin: '0 0 10px 0' }}>
                          Jetzt kann das Match-Paket mit Kontaktdaten an beide Parteien versendet werden.
                        </p>
                        {ps === 'idle' && <button onClick={() => sendeMatchPaket(match)} style={{ padding: '8px 16px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>📦 Match-Paket senden</button>}
                        {ps === 'sending' && <span style={{ fontSize: '12px', color: '#555' }}>⏳ Match-Paket wird versendet…</span>}
                        {ps === 'sent' && <span style={{ fontSize: '12px', color: '#4CAF50', fontWeight: 600 }}>✅ Match-Paket versendet — Kontaktdaten freigegeben</span>}
                        {ps === 'error' && <span style={{ fontSize: '12px', color: '#f44336' }}>❌ Fehler — API-Key prüfen</span>}
                      </div>
                    )}

                    {/* Kontaktdaten freigegeben / Erstkontakt offen */}
                    {['kontaktdaten_freigegeben', 'erstkontakt_offen'].includes(match.status) && (
                      <div style={{ padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '8px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1b5e20', marginBottom: '8px' }}>📦 Match-Paket wurde versendet</div>
                        {match.matchPaket && (
                          <div style={{ fontSize: '11px', color: '#444' }}>
                            <div>Versendet am: {match.matchPaket.versendetAm}</div>
                            <div>Empfohlener Erstkontakt: {match.matchPaket.empfohlenerErstkontakt === 'suchender' ? a.firmenname : match.interessentFirma}</div>
                            <div>Empfohlene Sprache: {match.matchPaket.empfohleneSprache}</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                          <button onClick={() => store.setzeMatchStatus(match.id, 'erstkontakt_erfolgt')} style={{ padding: '5px 12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>🤝 Erstkontakt erfolgt</button>
                          <button onClick={() => store.setzeMatchStatus(match.id, 'problem_gemeldet')} style={{ padding: '5px 12px', backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>⚠ Problem melden</button>
                        </div>
                      </div>
                    )}

                    {/* Erstkontakt erfolgt */}
                    {match.status === 'erstkontakt_erfolgt' && (
                      <div style={{ padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '8px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1b5e20', marginBottom: '6px' }}>🤝 Erstkontakt hat stattgefunden</div>
                        <button onClick={() => store.setzeMatchStatus(match.id, 'abgeschlossen')} style={{ padding: '5px 12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>⭐ Match abschließen</button>
                      </div>
                    )}

                    {/* Abgeschlossen */}
                    {match.status === 'abgeschlossen' && (
                      <div style={{ padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '8px', marginBottom: '10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '20px' }}>⭐</span>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1b5e20', marginTop: '4px' }}>Match erfolgreich abgeschlossen</div>
                      </div>
                    )}

                    {/* Problem gemeldet */}
                    {match.status === 'problem_gemeldet' && (
                      <div style={{ padding: '12px', backgroundColor: '#ffebee', borderRadius: '8px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#c62828', marginBottom: '6px' }}>⚠ Problem gemeldet</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => store.setzeMatchStatus(match.id, 'erstkontakt_offen')} style={{ padding: '5px 12px', backgroundColor: 'white', color: '#003366', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>↩ Wieder öffnen</button>
                          <button onClick={() => store.setzeMatchStatus(match.id, 'abgeschlossen')} style={{ padding: '5px 12px', backgroundColor: '#f5f5f5', color: '#555', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Abschließen</button>
                        </div>
                      </div>
                    )}

                    {/* DSGVO-Dokumentation (immer sichtbar wenn Zustimmungen vorhanden) */}
                    {(match.zustimmungSuchender || match.zustimmungInteressent) && !['freigabe_angefragt', 'suchender_zugestimmt', 'interessent_zugestimmt', 'beide_zugestimmt'].includes(match.status) && (
                      <div style={{ padding: '10px 12px', backgroundColor: '#f8f9fa', borderRadius: '6px', fontSize: '10px', color: '#444' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#444' }}>📋 DSGVO-Dokumentation</div>
                        {match.zustimmungSuchender && <div>✅ {match.zustimmungSuchender.unternehmen}: {new Date(match.zustimmungSuchender.zeitpunkt).toLocaleString('de-DE')} · {match.zustimmungSuchender.person}</div>}
                        {match.zustimmungInteressent && <div>✅ {match.zustimmungInteressent.unternehmen}: {new Date(match.zustimmungInteressent.zeitpunkt).toLocaleString('de-DE')} · {match.zustimmungInteressent.person}</div>}
                      </div>
                    )}

                    {/* Timeline */}
                    <div style={{ fontSize: '10px', color: '#555', marginTop: '8px' }}>
                      Erstellt: {match.erstelltAm} · Letzte Änderung: {match.letzteAenderung} · Von: {match.erstelltVon}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Abgelehnte Matches (eingeklappt) */}
          {abgelehnte.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px' }}>
                {abgelehnte.length} abgelehnte{abgelehnte.length !== 1 ? ' Matches' : 'r Match'}
              </div>
              {abgelehnte.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#fafafa', borderRadius: '4px', marginBottom: '4px', fontSize: '12px', color: '#555' }}>
                  <span>❌ {m.interessentFirma}</span>
                  <span>{m.ablehnungGrund || getMatchStatusLabel(m.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: '11px', color: '#555', marginTop: '10px', fontStyle: 'italic' }}>
        ℹ️ Kontaktdaten werden erst ausgetauscht, wenn <strong>beide</strong> Parteien aktiv zugestimmt haben (DSGVO-konform).
      </div>
    </Section>
  );
}

// ─── FORMULAR-ZUORDNUNG ───────────────────────────────────────

function FormularSektion({ anfrage: a, store, onToast }: {
  anfrage: MockAnfrage;
  store: ReturnType<typeof useStore>;
  onToast: (m: string) => void;
}) {
  const [zeigeVorschau, setZeigeVorschau] = useState(false);
  const interessentFormulare = store.formulare.filter(f => f.typ === 'interessent' && f.aktiv);

  // Auto-Vorauswahl: Branchen-Spezial vor Standard
  const autoInteressent = findeFormular(store.formulare, 'interessent', a.branche);
  const aktInteressentId = a.interessentFormularId || autoInteressent?.id || '';
  const aktInteressent = store.formulare.find(f => f.id === aktInteressentId);

  const SELECT: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: '4px' };

  return (
    <Section titel="Interessentenformular">
      <p style={{ fontSize: '12px', color: '#555', margin: '0 0 14px 0' }}>
        Bestimmt, welche Fragen ein Interessent beantworten muss, wenn er auf die Marktplatzanzeige dieses Projekts reagiert.
        Ohne Auswahl gilt automatisch das Branchen-Spezial- oder Standardformular.
      </p>

      {/* Formular-Auswahl */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#003366' }}>👥 Interessentenformular auswählen</label>
        <select
          value={aktInteressentId}
          onChange={e => { store.updateAnfrage(a.id, { interessentFormularId: e.target.value }); store.logge('Interessentenformular zugeordnet', a.anzeigenId, 'bearbeiten'); onToast('Interessentenformular zugeordnet ✓'); }}
          style={SELECT}
        >
          {interessentFormulare.map(f => (
            <option key={f.id} value={f.id}>{f.name}{f.istStandard ? ' (Standard)' : f.branche ? ` · ${f.branche}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Aktives Formular Info + Aktionen */}
      {aktInteressent && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: '#f0f4ff', borderRadius: '8px', border: '1px solid #d0ddf0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#003366' }}>{aktInteressent.name}</div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                {aktInteressent.fragen.length} Fragen
                {aktInteressent.branche && <span> · Branche: {aktInteressent.branche}</span>}
                {!a.interessentFormularId && autoInteressent ? ' · automatisch gewählt' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => setZeigeVorschau(prev => !prev)}
                style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, backgroundColor: 'white', color: '#003366', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer' }}
              >
                {zeigeVorschau ? '▴ Vorschau ausblenden' : '👁 Vorschau'}
              </button>
              <a href="/dashboard/formulare" style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
                ✏️ Bearbeiten
              </a>
            </div>
          </div>

          {/* Fragenvorschau */}
          {zeigeVorschau && (
            <div style={{ marginTop: '10px', borderTop: '1px solid #d0ddf0', paddingTop: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Fragen, die der Interessent beantworten muss:
              </div>
              {aktInteressent.fragen.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#555', fontStyle: 'italic' }}>Noch keine Fragen definiert.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {aktInteressent.fragen.map((fr, idx) => (
                    <div key={fr.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#333', padding: '4px 0' }}>
                      <span style={{ color: '#003366', fontWeight: 700, flexShrink: 0, minWidth: '18px' }}>{idx + 1}.</span>
                      <span>{fr.text}</span>
                      {fr.pflicht && <span style={{ color: '#c62828', fontSize: '10px', flexShrink: 0 }}>*</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Workflow-Hinweis */}
          <div style={{ marginTop: '10px', padding: '8px 10px', backgroundColor: '#e8f5e9', borderRadius: '6px', fontSize: '11px', color: '#1b5e20' }}>
            💡 Wenn dieses Projekt auf dem Marktplatz veröffentlicht wird, erhalten Interessenten automatisch dieses Formular beim Klick auf „Interesse bekunden".
          </div>
        </div>
      )}

      {!aktInteressent && (
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff8e1', borderRadius: '6px', fontSize: '12px', color: '#6d4c00' }}>
          ⚠️ Kein passendes Interessentenformular gefunden. Bitte im <a href="/dashboard/formulare" style={{ color: '#6d4c00', fontWeight: 700 }}>Formulare-Modul</a> ein aktives Interessentenformular erstellen.
        </div>
      )}
    </Section>
  );
}

// ─── MARKTPLATZ SEKTION ───────────────────────────────────────

const MS_META: Record<MarktplatzStatus, { label: string; color: string; bg: string }> = {
  intern:          { label: 'Intern',          color: '#757575', bg: '#f5f5f5' },
  entwurf:         { label: 'Entwurf',         color: '#E65100', bg: '#fff3e0' },
  zur_pruefung:    { label: 'Zur Prüfung',     color: '#1565C0', bg: '#e3f2fd' },
  veroeffentlicht: { label: 'Veröffentlicht',  color: '#2e7d32', bg: '#e8f5e9' },
  pausiert:        { label: 'Pausiert',        color: '#E65100', bg: '#fff3e0' },
  abgelaufen:      { label: 'Abgelaufen',      color: '#c62828', bg: '#ffebee' },
  archiviert:      { label: 'Archiviert',      color: '#546e7a', bg: '#eceff1' },
};

function MkBtn({ children, onClick, variant = 'default', disabled }: {
  children: React.ReactNode; onClick: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost'; disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ddd' },
    primary: { backgroundColor: '#003366', color: 'white', border: 'none' },
    danger:  { backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' },
    ghost:   { backgroundColor: 'transparent', color: '#003366', border: '1px solid #003366' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant], padding: '7px 14px', borderRadius: '6px', fontSize: '12px',
      fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      display: 'inline-flex', alignItems: 'center', gap: '5px',
    }}>
      {children}
    </button>
  );
}

function MarktplatzSektion({ anfrage, store, onToast }: {
  anfrage: MockAnfrage;
  store: ReturnType<typeof useStore>;
  onToast: (m: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [showVorschau, setShowVorschau] = useState(false);
  const [showDeaktivieren, setShowDeaktivieren] = useState(false);
  const [deaktiviereStatus, setDeaktiviereStatus] = useState<'pausiert'|'abgelaufen'|'archiviert'>('pausiert');
  const [deaktiviereGrund, setDeaktiviereGrund] = useState('');
  const [kiOutput, setKiOutput] = useState('');
  const [kiLoading, setKiLoading] = useState('');
  const [formData, setFormData] = useState<Partial<MarktplatzEintrag>>(anfrage.marktplatzDaten || {});
  const [dbSyncing, setDbSyncing] = useState(false);

  const ms: MarktplatzStatus = anfrage.marktplatzStatus || 'intern';
  const meta = MS_META[ms];
  const md = anfrage.marktplatzDaten;
  const today = new Date().toISOString().split('T')[0];

  function addMonths(date: string, n: number): string {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d.toISOString().split('T')[0];
  }

  // ── DB-Sync: Status in Neon speichern ────────────────────────
  async function syncDbStatus(neuerStatus: string) {
    setDbSyncing(true);
    try {
      await fetch('/api/anfragen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: anfrage.id, status: neuerStatus }),
      });
    } catch (e) {
      console.warn('[Marktplatz] DB-Sync fehlgeschlagen:', e);
    } finally {
      setDbSyncing(false);
    }
  }

  function erstelleEntwurf() {
    const neu: MarktplatzEintrag = {
      titel: anfrage.ziel,
      kurzbeschreibung: anfrage.beschreibung.slice(0, 250),
      branche: anfrage.branche,
      richtung: anfrage.richtung,
      region: anfrage.standort,
      wasSuche: anfrage.ziel,
      warumGesucht: anfrage.beschreibung,
      anforderungen: '',
      persoenlicheNote: '',
      kulturHinweis: anfrage.kulturHinweis || '',
      funFact: anfrage.funFactOeffentlich ? (anfrage.funFactAntwortKI || anfrage.funFactAntwort || '') : '',
      funFactFreigegeben: anfrage.funFactOeffentlich || false,
      sichtbarkeit: (anfrage.sichtbarkeit as 'oeffentlich' | 'anonym') || 'oeffentlich',
      laufzeitMonate: 3,
      entwurfErstelltAm: today,
    };
    store.updateAnfrage(anfrage.id, { marktplatzStatus: 'entwurf', marktplatzDaten: neu });
    store.logge('Marktplatz-Entwurf erstellt', anfrage.anzeigenId, 'status');
    setFormData(neu);
    setEditMode(true);
  }

  function speichereEntwurf() {
    const updated = { ...(md || {} as MarktplatzEintrag), ...formData, letzteBearbeitungAm: today };
    store.updateAnfrage(anfrage.id, { marktplatzDaten: updated });
    store.logge('Marktplatz-Entwurf bearbeitet', anfrage.anzeigenId, 'bearbeiten');
    setEditMode(false);
  }

  function zurPruefung() {
    speichereEntwurf();
    store.updateAnfrage(anfrage.id, { marktplatzStatus: 'zur_pruefung' });
    store.logge('Marktplatz-Eintrag zur Prüfung eingereicht', anfrage.anzeigenId, 'status');
  }

  async function veroeffentlichen() {
    const lm = formData.laufzeitMonate || md?.laufzeitMonate || 3;
    store.updateAnfrage(anfrage.id, {
      marktplatzStatus: 'veroeffentlicht',
      veroeffentlichtAm: today,
      ablaufDatum: addMonths(today, lm),
      veroeffentlichtVon: 'Operator',
    });
    store.logge(`Marktplatz-Eintrag veröffentlicht (${lm} Monate)`, anfrage.anzeigenId, 'status');
    // DB-Status auf "aktiv" setzen → Homepage zeigt es
    await syncDbStatus('aktiv');
    onToast('✅ Veröffentlicht — Projekt ist jetzt auf der Homepage sichtbar');
    setEditMode(false);
  }

  async function deaktivieren() {
    const grund = deaktiviereGrund || 'Kein Grund angegeben';
    store.updateAnfrage(anfrage.id, {
      marktplatzStatus: deaktiviereStatus,
      deaktivierungsGrund: grund,
    });
    store.logge(`Marktplatz-Eintrag ${deaktiviereStatus}: ${grund}`, anfrage.anzeigenId, 'status');
    // DB-Status auf "pausiert" setzen → verschwindet von der Homepage
    await syncDbStatus('pausiert');
    onToast(`✅ Vom Marktplatz genommen — Projekt ist nicht mehr öffentlich sichtbar`);
    setShowDeaktivieren(false);
    setDeaktiviereGrund('');
  }

  async function wiederVeroeffentlichen() {
    const lm = md?.laufzeitMonate || 3;
    store.updateAnfrage(anfrage.id, {
      marktplatzStatus: 'veroeffentlicht',
      veroeffentlichtAm: today,
      ablaufDatum: addMonths(today, lm),
      deaktivierungsGrund: undefined,
    });
    store.logge('Marktplatz-Eintrag wieder veröffentlicht', anfrage.anzeigenId, 'status');
    await syncDbStatus('aktiv');
    onToast('✅ Wieder veröffentlicht — Projekt ist jetzt auf der Homepage sichtbar');
  }

  function kiSimuliere(tool: string) {
    setKiLoading(tool);
    setTimeout(() => {
      const texte: Record<string, string> = {
        generieren: `[KI-Entwurf] ${anfrage.firmenname} sucht ${anfrage.ziel.toLowerCase()}. ${anfrage.beschreibung.slice(0, 180)} Bei Interesse melden Sie sich über den Easy-B2B-Marktplatz.`,
        kuerzen: (formData.kurzbeschreibung || md?.kurzbeschreibung || '').slice(0, 140) + '…',
        voicecheck: `✅ Klarheit: 8/10 · Vertrauen: 7/10 · Ansprache: 9/10\n💡 Verbesserung: Ersten Satz aktiver formulieren.`,
        anonymisieren: (formData.kurzbeschreibung || md?.kurzbeschreibung || '').replace(new RegExp(anfrage.firmenname, 'gi'), anfrage.richtung === 'de_dk' ? 'Ein deutsches Unternehmen' : 'Ein dänisches Unternehmen'),
      };
      setKiOutput(texte[tool] || '');
      setKiLoading('');
    }, 900);
  }

  const INPUT: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' };
  const TEXTAREA: React.CSSProperties = { ...INPUT, minHeight: '70px', resize: 'vertical' };

  return (
    <Section titel="Marktplatz-Veröffentlichung">
      {/* Vorschau-Modal */}
      {showVorschau && md && (
        <MarktplatzVorschau anfrage={anfrage} md={md} onClose={() => setShowVorschau(false)} />
      )}

      {/* Deaktivieren-Dialog */}
      {showDeaktivieren && (
        <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#E65100' }}>Eintrag vom Marktplatz nehmen</h4>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Neuer Status</label>
            <select value={deaktiviereStatus} onChange={e => setDeaktiviereStatus(e.target.value as typeof deaktiviereStatus)} style={{ ...INPUT, width: 'auto' }}>
              <option value="pausiert">Pausiert (vorübergehend)</option>
              <option value="abgelaufen">Abgelaufen (Laufzeit beendet)</option>
              <option value="archiviert">Archiviert (abgeschlossen)</option>
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Grund</label>
            <select value={deaktiviereGrund} onChange={e => setDeaktiviereGrund(e.target.value)} style={{ ...INPUT }}>
              <option value="">Bitte wählen…</option>
              <option value="Projekt erfolgreich abgeschlossen – Partner gefunden">Projekt erfolgreich abgeschlossen</option>
              <option value="Ansprechpartner momentan nicht erreichbar">Ansprechpartner nicht erreichbar</option>
              <option value="Inhalt soll überarbeitet werden">Inhalt überarbeiten</option>
              <option value="Keine Relevanz mehr">Keine Relevanz mehr</option>
              <option value="Anfrage abgelaufen">Anfrage abgelaufen</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <MkBtn onClick={deaktivieren} variant="danger" disabled={dbSyncing}>{dbSyncing ? '⏳ Wird gespeichert…' : '⏹ Jetzt vom Marktplatz nehmen'}</MkBtn>
            <MkBtn onClick={() => setShowDeaktivieren(false)} variant="ghost">Abbrechen</MkBtn>
          </div>
        </div>
      )}

      {/* Status-Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, color: meta.color, backgroundColor: meta.bg, border: `1px solid ${meta.color}40` }}>
          ● {meta.label}
        </span>
        {anfrage.veroeffentlichtAm && ms === 'veroeffentlicht' && <span style={{ fontSize: '12px', color: '#444' }}>Veröffentlicht: {anfrage.veroeffentlichtAm}</span>}
        {anfrage.ablaufDatum && ms === 'veroeffentlicht' && <span style={{ fontSize: '12px', color: '#444' }}>Läuft bis: {anfrage.ablaufDatum}</span>}
      </div>

      {anfrage.deaktivierungsGrund && ['pausiert','abgelaufen','archiviert'].includes(ms) && (
        <div style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: '#f5f5f5', borderRadius: '6px', fontSize: '12px', color: '#444' }}>
          <strong>Grund:</strong> {anfrage.deaktivierungsGrund}
        </div>
      )}

      {/* STATE: intern */}
      {ms === 'intern' && (
        <div style={{ padding: '20px', border: '2px dashed #e0e0e0', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📋</div>
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#555' }}>Noch nicht im öffentlichen Marktplatz sichtbar.</p>
          <MkBtn onClick={erstelleEntwurf} variant="primary">+ Marktplatz-Entwurf erstellen</MkBtn>
        </div>
      )}

      {/* STATE: entwurf / zur_pruefung */}
      {(ms === 'entwurf' || ms === 'zur_pruefung') && (
        <div>
          {!editMode && md && (
            <div style={{ marginBottom: '14px', padding: '12px 14px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, color: '#003366', marginBottom: '4px' }}>{md.titel}</div>
              <div style={{ color: '#444', lineHeight: 1.5 }}>{md.kurzbeschreibung?.slice(0, 150)}{(md.kurzbeschreibung?.length || 0) > 150 ? '…' : ''}</div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '11px', color: '#444' }}>
                <span>👁 {md.sichtbarkeit === 'oeffentlich' ? 'Öffentlich' : 'Anonym'}</span>
                <span>⏱ {md.laufzeitMonate} Monate</span>
              </div>
            </div>
          )}

          {editMode && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#444', fontWeight: 600, display: 'block', marginBottom: '3px' }}>TITEL</label>
                  <input style={INPUT} value={formData.titel || ''} onChange={e => setFormData(p => ({ ...p, titel: e.target.value }))} placeholder="Kurzer, prägnanter Titel…" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#444', fontWeight: 600, display: 'block', marginBottom: '3px' }}>KURZBESCHREIBUNG</label>
                  <textarea style={TEXTAREA} value={formData.kurzbeschreibung || ''} onChange={e => setFormData(p => ({ ...p, kurzbeschreibung: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#444', fontWeight: 600, display: 'block', marginBottom: '3px' }}>SICHTBARKEIT</label>
                    <select style={INPUT} value={formData.sichtbarkeit || 'oeffentlich'} onChange={e => setFormData(p => ({ ...p, sichtbarkeit: e.target.value as 'oeffentlich' | 'anonym' }))}>
                      <option value="oeffentlich">Öffentlich (mit Namen)</option>
                      <option value="anonym">Anonym</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#444', fontWeight: 600, display: 'block', marginBottom: '3px' }}>LAUFZEIT</label>
                    <select style={INPUT} value={formData.laufzeitMonate || 3} onChange={e => setFormData(p => ({ ...p, laufzeitMonate: Number(e.target.value) }))}>
                      <option value={1}>1 Monat</option>
                      <option value={2}>2 Monate</option>
                      <option value={3}>3 Monate</option>
                      <option value={6}>6 Monate</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', paddingBottom: '8px' }}>
                      <input type="checkbox" checked={formData.funFactFreigegeben || false} onChange={e => setFormData(p => ({ ...p, funFactFreigegeben: e.target.checked }))} />
                      FunFact freigeben
                    </label>
                  </div>
                </div>
              </div>

              {/* KI-Tools */}
              <div style={{ marginTop: '12px', padding: '12px 14px', backgroundColor: '#f0f4ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#003366', marginBottom: '8px' }}>🤖 KI-UNTERSTÜTZUNG</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[{ key: 'generieren', label: '✨ Text generieren' }, { key: 'kuerzen', label: '✂️ Kürzen' }, { key: 'voicecheck', label: '🎙 Voice Check' }, { key: 'anonymisieren', label: '👤 Anonymisieren' }].map(t => (
                    <button key={t.key} onClick={() => kiSimuliere(t.key)} disabled={kiLoading !== ''} style={{ padding: '5px 12px', backgroundColor: kiLoading === t.key ? '#e3f2fd' : 'white', border: '1px solid #90caf9', borderRadius: '6px', fontSize: '11px', cursor: kiLoading !== '' ? 'wait' : 'pointer', color: '#1565C0', fontWeight: 600 }}>
                      {kiLoading === t.key ? '⏳ …' : t.label}
                    </button>
                  ))}
                </div>
                {kiOutput && (
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #90caf9', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px', fontWeight: 600 }}>KI-ERGEBNIS (Entwurf — bitte prüfen):</div>
                    {kiOutput}
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                      <button onClick={() => { setFormData(p => ({ ...p, kurzbeschreibung: kiOutput })); setKiOutput(''); }} style={{ padding: '3px 10px', backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', color: '#2e7d32' }}>Übernehmen</button>
                      <button onClick={() => setKiOutput('')} style={{ padding: '3px 10px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', color: '#555' }}>Verwerfen</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!editMode ? (
              <>
                <MkBtn onClick={() => { setFormData(md || {}); setEditMode(true); }} variant="ghost">✏️ Bearbeiten</MkBtn>
                {md && <MkBtn onClick={() => setShowVorschau(true)} variant="default">👁 Vorschau</MkBtn>}
                {ms === 'entwurf' && <MkBtn onClick={zurPruefung} variant="default">→ Zur Prüfung</MkBtn>}
                <MkBtn onClick={veroeffentlichen} variant="primary" disabled={dbSyncing}>{dbSyncing ? '⏳ …' : '🚀 Jetzt veröffentlichen'}</MkBtn>
              </>
            ) : (
              <>
                <MkBtn onClick={speichereEntwurf} variant="primary">💾 Speichern</MkBtn>
                <MkBtn onClick={() => setShowVorschau(true)} variant="default">👁 Vorschau</MkBtn>
                <MkBtn onClick={() => setEditMode(false)} variant="ghost">Abbrechen</MkBtn>
              </>
            )}
          </div>
        </div>
      )}

      {/* STATE: veroeffentlicht */}
      {ms === 'veroeffentlicht' && (
        <div>
          {md && (
            <div style={{ marginBottom: '14px', padding: '14px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #a5d6a7' }}>
              <div style={{ fontWeight: 700, color: '#1b5e20', marginBottom: '4px', fontSize: '14px' }}>{md.titel}</div>
              <div style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '6px' }}>{md.kurzbeschreibung?.slice(0, 150)}{(md.kurzbeschreibung?.length || 0) > 150 ? '…' : ''}</div>
              <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#388e3c' }}>
                <span>👁 {md.sichtbarkeit === 'oeffentlich' ? 'Öffentlich sichtbar' : 'Anonym sichtbar'}</span>
                <span>⏱ {md.laufzeitMonate} Monate</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <MkBtn onClick={() => { setFormData(md || {}); store.updateAnfrage(anfrage.id, { marktplatzStatus: 'entwurf' }); }} variant="ghost">✏️ Inhalt bearbeiten</MkBtn>
            {md && <MkBtn onClick={() => setShowVorschau(true)} variant="default">👁 Vorschau</MkBtn>}
            <MkBtn onClick={() => setShowDeaktivieren(true)} variant="danger" disabled={dbSyncing}>
              {dbSyncing ? '⏳ Wird gespeichert…' : '⏹ Vom Marktplatz nehmen'}
            </MkBtn>
          </div>
        </div>
      )}

      {/* STATE: pausiert / abgelaufen / archiviert */}
      {['pausiert', 'abgelaufen', 'archiviert'].includes(ms) && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ms !== 'archiviert' && (
            <MkBtn onClick={wiederVeroeffentlichen} variant="primary" disabled={dbSyncing}>
              {dbSyncing ? '⏳ Wird gespeichert…' : '🔄 Wieder veröffentlichen'}
            </MkBtn>
          )}
          {ms === 'archiviert' && (
            <MkBtn onClick={() => { store.updateAnfrage(anfrage.id, { marktplatzStatus: 'entwurf' }); store.logge('Reaktiviert als Entwurf', anfrage.anzeigenId, 'status'); onToast('Entwurf wiederhergestellt'); }} variant="ghost">↩ Als Entwurf reaktivieren</MkBtn>
          )}
          {ms !== 'archiviert' && (
            <MkBtn onClick={() => { store.updateAnfrage(anfrage.id, { marktplatzStatus: 'archiviert' }); syncDbStatus('archiviert').then(() => onToast('Archiviert')); }} variant="danger">🗄 Archivieren</MkBtn>
          )}
          {md && <MkBtn onClick={() => setShowVorschau(true)} variant="default">👁 Letzter Entwurf</MkBtn>}
        </div>
      )}
    </Section>
  );
}

// ─── HILFSFUNKTIONEN ──────────────────────────────────────────

function naechsteAufgabe(s: ReturnType<typeof berechneProjekt>, anzInteressenten: number, ms?: string): string {
  if (!ms || ms === 'intern') return 'Marktplatz-Entwurf erstellen und Anfrage veröffentlichen.';
  if (ms === 'entwurf') return 'Marktplatz-Entwurf fertigstellen und prüfen.';
  if (ms === 'zur_pruefung') return 'Marktplatz-Eintrag final prüfen und veröffentlichen.';
  if (ms === 'pausiert' || ms === 'abgelaufen') return 'Entscheiden: wieder veröffentlichen, überarbeiten oder archivieren?';
  if (anzInteressenten === 0) return 'Aktives Matchmaking starten oder Gesuch überarbeiten.';
  if (s.kpi.freigegeben === 0) return 'Neue Interessenten prüfen und freigeben.';
  if (s.kpi.kontakte === 0) return 'Kontakt zwischen Suchendem und freigegebenem Interessenten herstellen.';
  if (s.kpi.erfolge === 0) return 'Feedback zum laufenden Kontakt einholen.';
  return 'Projekt läuft erfolgreich — Success Story dokumentieren.';
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontWeight: 700, color, fontSize: '14px' }}>{value}</span>
      <span style={{ color: '#555' }}>{label}</span>
    </span>
  );
}

// ─── MARKTPLATZ-REICHINHALT (Editor für neue öffentliche Felder) ──

function MarktplatzReichinhalt({ anfrage: a, store, onToast }: {
  anfrage: MockAnfrage;
  store: ReturnType<typeof useStore>;
  onToast: (m: string) => void;
}) {
  const speichere = (patch: Partial<MockAnfrage>, label: string) => {
    store.updateAnfrage(a.id, patch);
    store.logge(`Marktplatz-Reichinhalt: ${label} aktualisiert`, a.anzeigenId || a.id, 'bearbeiten');
    onToast(`${label} gespeichert ✓`);
  };

  return (
    <Section titel="Marktplatz-Reichinhalt (was Interessenten sehen)">
      <p style={{ fontSize: '12px', color: '#555', margin: '0 0 14px 0' }}>
        Diese Inhalte machen die Anzeige zu einer „vorbereiteten Anfrage" — Motivation, Ziele, Erwartungen und Vorbereitung werden öffentlich angezeigt.
      </p>

      {/* Reifegrad / Konkretisierungsgrad */}
      <EditableSection
        titel="Wie konkret ist das Vorhaben? (Reifegrad 1–10)"
        startWerte={{
          reifegradScore: String(a.reifegradScore || ''),
          reifegradBeschreibung: a.reifegradBeschreibung || '',
        }}
        beimSpeichern={(w) => speichere({
          reifegradScore: w.reifegradScore ? Math.min(10, Math.max(1, parseInt(w.reifegradScore))) : undefined,
          reifegradBeschreibung: w.reifegradBeschreibung || undefined,
        }, 'Reifegrad')}
        rendere={(w, set, edit) => {
          const score = parseInt(w.reifegradScore) || 0;
          const lbl = score <= 3 ? 'Erste Idee' : score <= 6 ? 'Konkrete Richtung' : score <= 8 ? 'Gut vorbereitet' : score <= 10 ? 'Startklar' : '—';
          const clr = score <= 3 ? '#94a3b8' : score <= 6 ? '#f59e0b' : score <= 8 ? '#3b82f6' : '#10b981';
          return edit ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                <label style={editLabelStyle}>Score (1–10)</label>
                <input type="number" min={1} max={10} style={{ ...editInputStyle, width: '80px' }} value={w.reifegradScore} onChange={e => set('reifegradScore', e.target.value)} />
                {score >= 1 && score <= 10 && (
                  <span style={{ padding: '3px 10px', backgroundColor: clr, color: 'white', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>{lbl}</span>
                )}
              </div>
              {/* Visuelle Vorschau */}
              {score >= 1 && score <= 10 && (
                <div style={{ display: 'flex', gap: '3px', marginBottom: '12px' }}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} style={{ flex: 1, height: '8px', borderRadius: i === 0 ? '4px 0 0 4px' : i === 9 ? '0 4px 4px 0' : '0', backgroundColor: i < score ? clr : '#e2e8f0' }} />
                  ))}
                </div>
              )}
              <label style={editLabelStyle}>Öffentliche Beschreibung (optional)</label>
              <textarea style={editTextareaStyle} value={w.reifegradBeschreibung} onChange={e => set('reifegradBeschreibung', e.target.value)} placeholder="z.B. Gut vorbereitet — Unterlagen liegen vor, Preislisten werden erstellt…" />
            </div>
          ) : score >= 1 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: clr }}>{score}</span>
                <span style={{ fontSize: '13px', color: '#555' }}>von 10</span>
                <span style={{ padding: '3px 10px', backgroundColor: clr, color: 'white', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>{lbl}</span>
              </div>
              <div style={{ display: 'flex', gap: '3px', marginBottom: w.reifegradBeschreibung ? '10px' : '0' }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} style={{ flex: 1, height: '8px', borderRadius: i === 0 ? '4px 0 0 4px' : i === 9 ? '0 4px 4px 0' : '0', backgroundColor: i < score ? clr : '#e2e8f0' }} />
                ))}
              </div>
              {w.reifegradBeschreibung && <p style={{ fontSize: '13px', color: '#333', lineHeight: 1.6, margin: 0 }}>{w.reifegradBeschreibung}</p>}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#555', fontStyle: 'italic', margin: 0 }}>Noch kein Reifegrad festgelegt.</p>
          );
        }}
      />

      {/* Motivation */}
      <EditableSection
        titel="Warum dieses Projekt gestartet wurde (Motivation)"
        startWerte={{ motivation: a.motivation || '' }}
        beimSpeichern={(w) => speichere({ motivation: w.motivation || undefined }, 'Motivation')}
        rendere={(w, set, edit) => edit ? (
          <textarea style={editTextareaStyle} value={w.motivation} onChange={e => set('motivation', e.target.value)} placeholder="Warum wird gerade jetzt gesucht? Was steckt dahinter?" />
        ) : w.motivation ? (
          <p style={{ fontSize: '13px', color: '#333', lineHeight: 1.6, margin: 0 }}>{w.motivation}</p>
        ) : (
          <p style={{ fontSize: '13px', color: '#555', fontStyle: 'italic', margin: 0 }}>Noch keine Motivation erfasst.</p>
        )}
      />

      {/* Ziele */}
      <EditableSection
        titel="Was ein gutes Ergebnis wäre (Ziele)"
        startWerte={{ ziele: (a.ziele || []).join('\n') }}
        beimSpeichern={(w) => speichere({ ziele: zeilen(w.ziele) }, 'Ziele')}
        rendere={(w, set, edit) => edit ? (
          <div>
            <p style={{ fontSize: '11px', color: '#555', margin: '0 0 4px 0' }}>Ein Ziel pro Zeile:</p>
            <textarea style={{ ...editTextareaStyle, minHeight: '120px' }} value={w.ziele} onChange={e => set('ziele', e.target.value)} placeholder="2-3 aktive Vertriebspartner&#10;Erste Listungen im LEH&#10;Pilotregion Norddeutschland" />
          </div>
        ) : zeilen(w.ziele).length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: '18px' }}>{zeilen(w.ziele).map((z: string, i: number) => <li key={i} style={{ fontSize: '13px', color: '#333', padding: '2px 0' }}>{z}</li>)}</ul>
        ) : (
          <p style={{ fontSize: '13px', color: '#555', fontStyle: 'italic', margin: 0 }}>Noch keine Ziele erfasst.</p>
        )}
      />

      {/* Partner-Erwartungen */}
      <EditableSection
        titel="Was wir uns von einem Partner wünschen (Erwartungen)"
        startWerte={{ partnerErwartungen: (a.partnerErwartungen || []).join('\n') }}
        beimSpeichern={(w) => speichere({ partnerErwartungen: zeilen(w.partnerErwartungen) }, 'Partner-Erwartungen')}
        rendere={(w, set, edit) => edit ? (
          <div>
            <p style={{ fontSize: '11px', color: '#555', margin: '0 0 4px 0' }}>Eine Erwartung pro Zeile:</p>
            <textarea style={{ ...editTextareaStyle, minHeight: '120px' }} value={w.partnerErwartungen} onChange={e => set('partnerErwartungen', e.target.value)} placeholder="Kontakte zum LEH&#10;Erfahrung im Food-Vertrieb&#10;Langfristige Zusammenarbeit" />
          </div>
        ) : zeilen(w.partnerErwartungen).length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: '18px' }}>{zeilen(w.partnerErwartungen).map((z: string, i: number) => <li key={i} style={{ fontSize: '13px', color: '#333', padding: '2px 0' }}>{z}</li>)}</ul>
        ) : (
          <p style={{ fontSize: '13px', color: '#555', fontStyle: 'italic', margin: 0 }}>Noch keine Erwartungen erfasst.</p>
        )}
      />

      {/* Zielgruppe */}
      <EditableSection
        titel="Für wen besonders interessant (Zielgruppe)"
        startWerte={{ zielgruppe: (a.zielgruppe || []).join('\n') }}
        beimSpeichern={(w) => speichere({ zielgruppe: zeilen(w.zielgruppe) }, 'Zielgruppe')}
        rendere={(w, set, edit) => edit ? (
          <div>
            <p style={{ fontSize: '11px', color: '#555', margin: '0 0 4px 0' }}>Ein Tag pro Zeile:</p>
            <textarea style={editTextareaStyle} value={w.zielgruppe} onChange={e => set('zielgruppe', e.target.value)} placeholder="Handelsagenten&#10;Food-Vertriebspartner&#10;LEH-Spezialisten" />
          </div>
        ) : zeilen(w.zielgruppe).length > 0 ? (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {zeilen(w.zielgruppe).map((z: string, i: number) => (
              <span key={i} style={{ padding: '4px 10px', backgroundColor: '#e3f2fd', color: '#0d47a1', borderRadius: '14px', fontSize: '12px', fontWeight: 600 }}>🏷 {z}</span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: '#555', fontStyle: 'italic', margin: 0 }}>Noch keine Zielgruppe definiert.</p>
        )}
      />

      {/* Vorbereitung */}
      <EditableSection
        titel="Was bereits vorhanden ist (Vorbereitung)"
        startWerte={{
          produktunterlagen: !!a.vorbereitung?.produktunterlagen,
          preislisten: !!a.vorbereitung?.preislisten,
          zertifikate: !!a.vorbereitung?.zertifikate,
          produktproben: !!a.vorbereitung?.produktproben,
          marketingmaterial: !!a.vorbereitung?.marketingmaterial,
          referenzen: !!a.vorbereitung?.referenzen,
          webseiteDeutsch: !!a.vorbereitung?.webseiteDeutsch,
          notiz: a.vorbereitung?.notiz || '',
        }}
        beimSpeichern={(w) => speichere({
          vorbereitung: {
            produktunterlagen: w.produktunterlagen,
            preislisten: w.preislisten,
            zertifikate: w.zertifikate,
            produktproben: w.produktproben,
            marketingmaterial: w.marketingmaterial,
            referenzen: w.referenzen,
            webseiteDeutsch: w.webseiteDeutsch,
            notiz: w.notiz || undefined,
          },
        }, 'Vorbereitung')}
        rendere={(w, set, edit) => {
          const items: { key: keyof typeof w; label: string }[] = [
            { key: 'produktunterlagen', label: 'Produktunterlagen' },
            { key: 'preislisten', label: 'Preislisten' },
            { key: 'zertifikate', label: 'Zertifikate' },
            { key: 'produktproben', label: 'Produktproben' },
            { key: 'marketingmaterial', label: 'Marketingmaterial' },
            { key: 'referenzen', label: 'Referenzen' },
            { key: 'webseiteDeutsch', label: 'Deutsche Website' },
          ];
          return edit ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', marginBottom: '10px' }}>
                {items.map(it => (
                  <label key={it.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!w[it.key]} onChange={e => set(it.key, e.target.checked as never)} />
                    {it.label}
                  </label>
                ))}
              </div>
              <label style={editLabelStyle}>Zusätzliche Notiz (z.B. „Preislisten in Vorbereitung")</label>
              <textarea style={{ ...editTextareaStyle, minHeight: '60px' }} value={w.notiz as string} onChange={e => set('notiz', e.target.value as never)} />
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px' }}>
                {items.map(it => (
                  <div key={it.key} style={{ fontSize: '13px', color: w[it.key] ? '#1b5e20' : '#777' }}>
                    {w[it.key] ? '✓' : '○'} {it.label}
                  </div>
                ))}
              </div>
              {!!w.notiz && (
                <div style={{ marginTop: '8px', padding: '6px 10px', backgroundColor: '#fff8e1', borderRadius: '6px', fontSize: '12px', color: '#5d4037', fontStyle: 'italic' }}>💡 {w.notiz}</div>
              )}
            </div>
          );
        }}
      />

      {/* Zeitfenster */}
      <EditableSection
        titel="Aktuelles Zeitfenster"
        startWerte={{
          projektStartDatum: a.projektStartDatum || '',
          projektEndDatum: a.projektEndDatum || '',
          erstgespraechFristDatum: a.erstgespraechFristDatum || '',
        }}
        beimSpeichern={(w) => speichere({
          projektStartDatum: w.projektStartDatum || undefined,
          projektEndDatum: w.projektEndDatum || undefined,
          erstgespraechFristDatum: w.erstgespraechFristDatum || undefined,
        }, 'Zeitfenster')}
        rendere={(w, set, edit) => edit ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={editLabelStyle}>Aktive Suche ab</label>
              <input type="date" style={editInputStyle} value={w.projektStartDatum} onChange={e => set('projektStartDatum', e.target.value)} />
            </div>
            <div>
              <label style={editLabelStyle}>Aktive Suche bis</label>
              <input type="date" style={editInputStyle} value={w.projektEndDatum} onChange={e => set('projektEndDatum', e.target.value)} />
            </div>
            <div>
              <label style={editLabelStyle}>Erstgespräch bis</label>
              <input type="date" style={editInputStyle} value={w.erstgespraechFristDatum} onChange={e => set('erstgespraechFristDatum', e.target.value)} />
            </div>
          </div>
        ) : (w.projektStartDatum || w.projektEndDatum || w.erstgespraechFristDatum) ? (
          <div style={{ fontSize: '13px', color: '#333' }}>
            {(w.projektStartDatum || w.projektEndDatum) && (
              <div>📅 <strong>Aktive Suche:</strong> {w.projektStartDatum || '?'} – {w.projektEndDatum || '?'}</div>
            )}
            {w.erstgespraechFristDatum && <div>💬 <strong>Erste Gespräche bis:</strong> {w.erstgespraechFristDatum}</div>}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: '#555', fontStyle: 'italic', margin: 0 }}>Noch kein Zeitfenster definiert.</p>
        )}
      />
    </Section>
  );
}

function zeilen(s: string): string[] {
  return (s || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
}

// ─── MARKTPLATZ-VORSCHAU (entspricht der Homepage-Detailseite) ─

function MarktplatzVorschau({ anfrage, md, onClose }: {
  anfrage: MockAnfrage;
  md: MarktplatzEintrag;
  onClose: () => void;
}) {
  // Klärungspunkte für die Anzeige (Whitelist — nur öffentlich relevante)
  const klaerung = [
    { titel: 'Ansprechpartner vorhanden',          erfuellt: !!anfrage.ansprechpartner },
    { titel: 'Suchziel definiert',                 erfuellt: !!anfrage.ziel },
    { titel: 'Zielregion definiert',               erfuellt: !!md.region || !!anfrage.standort },
    { titel: 'Kommunikationssprachen geklärt',     erfuellt: (anfrage.sprachen?.length || 0) > 0 },
    { titel: 'Zeitfenster abgestimmt',             erfuellt: !!anfrage.projektEndDatum || !!anfrage.ablaufDatum },
    { titel: 'Erwartung an Partner beschrieben',   erfuellt: (anfrage.partnerErwartungen?.length || 0) > 0 || !!md.anforderungen },
    { titel: 'Erstgespräch grundsätzlich erwünscht', erfuellt: !!anfrage.erstgespraechFristDatum || !!anfrage.gespraechseinstieg },
    { titel: 'Produktunterlagen vorhanden',        erfuellt: !!anfrage.vorbereitung?.produktunterlagen },
    { titel: 'Preislisten vorhanden bzw. in Vorbereitung', erfuellt: !!anfrage.vorbereitung?.preislisten || !!anfrage.vorbereitung?.notiz },
  ];

  const vorbereitungsLabel: Record<string, string> = {
    produktunterlagen: 'Produktunterlagen',
    preislisten: 'Preislisten',
    zertifikate: 'Zertifikate',
    produktproben: 'Produktproben',
    marketingmaterial: 'Marketingmaterial',
    referenzen: 'Referenzen',
    webseiteDeutsch: 'Deutsche Website',
  };

  function formatDatum(iso?: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    } catch { return iso; }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 4000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '720px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', margin: '20px 0' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', backgroundColor: '#003366', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px 12px 0 0', position: 'sticky', top: 0, zIndex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>Vorschau — So erscheint die Anzeige auf der Homepage</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Anzeigen-Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Meta-Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px' }}>{md.richtung === 'dk_de' ? '🇩🇰 → 🇩🇪' : '🇩🇪 → 🇩🇰'}</span>
            <span style={{ padding: '3px 10px', backgroundColor: '#e3f2fd', color: '#0d47a1', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>{md.branche}</span>
            {md.sichtbarkeit === 'anonym' && <span style={{ padding: '3px 10px', backgroundColor: '#f3e5f5', color: '#4a148c', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>Anonym</span>}
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '11px', color: '#555', backgroundColor: '#eee', padding: '2px 8px', borderRadius: '4px' }}>{anfrage.anzeigenId}</span>
          </div>

          <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', color: '#003366', lineHeight: 1.3 }}>{md.titel}</h1>
          <div style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>
            {md.sichtbarkeit === 'anonym' ? '🔒 Anonyme Anfrage' : `📍 ${anfrage.standort}`}
          </div>

          {/* Reifegrad / Konkretisierungsgrad */}
          {(() => {
            const score = anfrage.reifegradScore || 5;
            const lbl = score <= 3 ? 'Erste Idee' : score <= 6 ? 'Konkrete Richtung' : score <= 8 ? 'Gut vorbereitet' : 'Startklar';
            const clr = score <= 3 ? '#94a3b8' : score <= 6 ? '#f59e0b' : score <= 8 ? '#3b82f6' : '#10b981';
            const bg = score <= 3 ? '#f1f5f9' : score <= 6 ? '#fffbeb' : score <= 8 ? '#eff6ff' : '#ecfdf5';
            const brd = score <= 3 ? '#cbd5e1' : score <= 6 ? '#fde68a' : score <= 8 ? '#bfdbfe' : '#a7f3d0';
            return (
              <VBlock titel="Wie konkret ist das Vorhaben?" akzent={bg}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: clr, lineHeight: 1 }}>{score}</span>
                  <span style={{ fontSize: '13px', color: '#555' }}>von 10</span>
                  <span style={{ padding: '4px 12px', backgroundColor: clr, color: 'white', borderRadius: '16px', fontSize: '12px', fontWeight: 700 }}>{lbl}</span>
                </div>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} style={{ flex: 1, height: '8px', borderRadius: i === 0 ? '4px 0 0 4px' : i === 9 ? '0 4px 4px 0' : '0', backgroundColor: i < score ? clr : '#e2e8f0' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', marginBottom: anfrage.reifegradBeschreibung ? '12px' : '0' }}>
                  <span>Erste Idee</span><span>Konkrete Richtung</span><span>Gut vorbereitet</span><span>Startklar</span>
                </div>
                {anfrage.reifegradBeschreibung && (
                  <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '6px', fontSize: '13px', color: '#333', lineHeight: 1.6 }}>
                    {anfrage.reifegradBeschreibung}
                  </div>
                )}
              </VBlock>
            );
          })()}

          {/* 1. Was wird gesucht? */}
          <VBlock titel="Was wird gesucht?">
            <p style={{ margin: 0, fontSize: '14px', color: '#333', lineHeight: 1.7 }}>{md.kurzbeschreibung}</p>
            {md.wasSuche && <p style={{ marginTop: '10px', fontSize: '14px', color: '#333', lineHeight: 1.7 }}><strong style={{ color: '#003366' }}>Konkret gesucht:</strong> {md.wasSuche}</p>}
          </VBlock>

          {/* 2. Von Easy-B2B vorbereitet */}
          <VBlock titel="✓ Von Easy-B2B vorbereitet" akzent="#e8f5e9">
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#1b5e20', fontWeight: 500 }}>
              Diese Punkte wurden im Vorfeld bereits geklärt:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '6px' }}>
              {klaerung.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: p.erfuellt ? '#1b5e20' : '#777' }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: p.erfuellt ? '#2e7d32' : 'transparent', border: p.erfuellt ? 'none' : '2px solid #ccc', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>{p.erfuellt ? '✓' : ''}</span>
                  <span style={{ textDecoration: p.erfuellt ? 'none' : 'none' }}>{p.titel}</span>
                </div>
              ))}
            </div>
          </VBlock>

          {/* 3. Warum gestartet (motivation) */}
          {anfrage.motivation && (
            <VBlock titel="Warum dieses Projekt gestartet wurde">
              <p style={{ margin: 0, fontSize: '14px', color: '#333', lineHeight: 1.7 }}>{anfrage.motivation}</p>
            </VBlock>
          )}

          {/* 4. Was ein gutes Ergebnis wäre (ziele) */}
          {(anfrage.ziele?.length || 0) > 0 && (
            <VBlock titel="Was ein gutes Ergebnis wäre">
              <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none' }}>
                {anfrage.ziele!.map((z, i) => (
                  <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: '#333', lineHeight: 1.6, padding: '4px 0' }}>
                    <span style={{ color: '#FF9900', fontWeight: 700, flexShrink: 0 }}>→</span>
                    <span>{z}</span>
                  </li>
                ))}
              </ul>
            </VBlock>
          )}

          {/* 5. Aktuelles Zeitfenster */}
          {(anfrage.projektStartDatum || anfrage.projektEndDatum || anfrage.erstgespraechFristDatum) && (
            <VBlock titel="Aktuelles Zeitfenster">
              {(anfrage.projektStartDatum || anfrage.projektEndDatum) && (
                <div style={{ fontSize: '14px', color: '#333', marginBottom: '6px' }}>
                  📅 <strong>Aktive Suche:</strong> {formatDatum(anfrage.projektStartDatum)}
                  {anfrage.projektEndDatum && ` – ${formatDatum(anfrage.projektEndDatum)}`}
                </div>
              )}
              {anfrage.erstgespraechFristDatum && (
                <div style={{ fontSize: '14px', color: '#333' }}>
                  💬 <strong>Erste Gespräche gewünscht bis:</strong> {formatDatum(anfrage.erstgespraechFristDatum)}
                </div>
              )}
            </VBlock>
          )}

          {/* 6. Erwartungen */}
          {(anfrage.partnerErwartungen?.length || 0) > 0 && (
            <VBlock titel="Was wir uns von einem Partner wünschen">
              <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none' }}>
                {anfrage.partnerErwartungen!.map((e, i) => (
                  <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: '#333', lineHeight: 1.6, padding: '4px 0' }}>
                    <span style={{ color: '#003366', fontWeight: 700, flexShrink: 0 }}>•</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </VBlock>
          )}

          {/* 7. Vorbereitung */}
          {anfrage.vorbereitung && (
            <VBlock titel="Was bereits vorhanden ist">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: anfrage.vorbereitung.notiz ? '10px' : 0 }}>
                {Object.entries(vorbereitungsLabel).map(([key, label]) => {
                  const erfuellt = !!(anfrage.vorbereitung as any)[key];
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: erfuellt ? '#1b5e20' : '#777' }}>
                      <span style={{ width: '14px', flexShrink: 0, fontSize: '14px' }}>{erfuellt ? '✓' : '○'}</span>
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
              {anfrage.vorbereitung.notiz && (
                <div style={{ padding: '8px 12px', backgroundColor: '#fff8e1', borderRadius: '6px', fontSize: '12px', color: '#5d4037', fontStyle: 'italic', marginTop: '8px' }}>
                  💡 {anfrage.vorbereitung.notiz}
                </div>
              )}
            </VBlock>
          )}

          {/* 8. Zielgruppe */}
          {(anfrage.zielgruppe?.length || 0) > 0 && (
            <VBlock titel="Für wen dieses Projekt besonders interessant ist">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {anfrage.zielgruppe!.map((z, i) => (
                  <span key={i} style={{ padding: '6px 12px', backgroundColor: '#e3f2fd', color: '#0d47a1', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
                    🏷 {z}
                  </span>
                ))}
              </div>
            </VBlock>
          )}

          {/* FunFact (wenn freigegeben) */}
          {md.funFactFreigegeben && md.funFact && (
            <VBlock titel="🎉 Fun Fact">
              <p style={{ margin: 0, fontSize: '13px', color: '#5d4037', backgroundColor: '#fff8e1', padding: '10px 14px', borderRadius: '6px', lineHeight: 1.6 }}>
                {md.funFact}
              </p>
            </VBlock>
          )}

          {/* 11. Bevor Sie Ihr Interesse bekunden */}
          <VBlock titel="Bevor Sie Ihr Interesse bekunden" akzent="#f0f4ff">
            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#003366', fontWeight: 500 }}>
              Folgende Informationen werden im Anschluss abgefragt:
            </p>
            {[
              'Warum passt Ihr Unternehmen zu diesem Projekt?',
              'Welche Erfahrung bringen Sie mit?',
              'Welche Regionen decken Sie ab?',
              'Welche Kontakte oder Netzwerke sind vorhanden?',
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#333', padding: '3px 0' }}>
                <span style={{ color: '#003366', flexShrink: 0 }}>→</span>
                <span>{f}</span>
              </div>
            ))}
          </VBlock>

          {/* CTA */}
          <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#003366', borderRadius: '10px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#a8c4e0' }}>Passt das zu Ihnen?</p>
            <div style={{ display: 'inline-block', padding: '12px 28px', backgroundColor: '#FF9900', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: 700 }}>
              Interesse bekunden →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VBlock({ titel, children, akzent }: { titel: string; children: React.ReactNode; akzent?: string }) {
  return (
    <div style={{ marginBottom: '20px', padding: akzent ? '14px 16px' : 0, backgroundColor: akzent, borderRadius: akzent ? '8px' : 0 }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#003366', letterSpacing: '0.3px' }}>{titel}</h3>
      {children}
    </div>
  );
}

function Section({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e8e8e8' }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{titel}</h3>
      {children}
    </div>
  );
}
