
import {
  MOCK_ANFRAGEN,
  MOCK_INTERESSENTEN,
  MOCK_EVENTS,
  MOCK_SUCCESS_STORIES,
  MOCK_NETZWERKKONTAKTE,
  getStatusLabel,
  getStatusColor,
  getRichtungLabel,
} from '@easyb2b/lib/mockdata';
import { MOCK_KULTUR_MOMENTE, MOCK_GRENZGESCHICHTEN } from '@easyb2b/lib/kultur';
import { useStore } from '@easyb2b/lib/store';

export default function DashboardPage() {
  const { aktivitaeten } = useStore();
  const totalAnfragen = MOCK_ANFRAGEN.length;
  const activeAnfragen = MOCK_ANFRAGEN.filter(a => a.status === 'aktiv').length;
  const eingehend = MOCK_ANFRAGEN.filter(a => a.status === 'eingehend').length;
  const totalInteressenten = MOCK_INTERESSENTEN.length;
  const neueInteressenten = MOCK_INTERESSENTEN.filter(i => i.status === 'neu').length;
  const erfolgreich = MOCK_INTERESSENTEN.filter(i => i.status === 'erfolgreich').length;
  const naechsteEvents = MOCK_EVENTS.filter(e => e.status === 'geplant' || e.status === 'veroeffentlicht').length;
  const eventKooperationen = MOCK_EVENTS.reduce((s, e) => s + e.matches.filter(m => m.kooperation).length, 0);
  const successStoriesGesamt = MOCK_SUCCESS_STORIES.length;
  const storiesFreigegeben = MOCK_SUCCESS_STORIES.filter(s => s.freigabe === 'freigegeben').length;
  const netzwerkKontakte = MOCK_NETZWERKKONTAKTE.length;
  const alleEmpfehlungen = MOCK_NETZWERKKONTAKTE.reduce((s, k) => s + k.empfehlungen.filter(e => e.erfolgreich).length, 0);
  const wissensEintraege = MOCK_KULTUR_MOMENTE.length + MOCK_GRENZGESCHICHTEN.length;

  const recentAnfragen = [...MOCK_ANFRAGEN].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  const recentInteressenten = [...MOCK_INTERESSENTEN].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: '24px', color: '#003366', fontSize: '24px' }}>
        Dashboard Übersicht
      </h1>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Gesamt Anfragen" value={totalAnfragen} color="#003366" />
        <StatCard label="Aktive Anfragen" value={activeAnfragen} color="#4CAF50" />
        <StatCard label="Neue Eingehende" value={eingehend} color="#FF9900" />
        <StatCard label="Interessenten" value={totalInteressenten} color="#2196F3" />
        <StatCard label="Neue Interessenten" value={neueInteressenten} color="#9C27B0" />
        <StatCard label="Erfolgreiche Matches" value={erfolgreich} color="#4CAF50" />
        <StatCard label="Nächste Events" value={naechsteEvents} color="#E91E63" />
        <StatCard label="Kooperationen aus Events" value={eventKooperationen} color="#009688" />
        <StatCard label="⭐ Success Stories" value={successStoriesGesamt} color="#FF9900" />
        <StatCard label="Stories öffentlich" value={storiesFreigegeben} color="#4CAF50" />
        <StatCard label="🕸 Netzwerkkontakte" value={netzwerkKontakte} color="#9C27B0" />
        <StatCard label="Erfolgreiche Empf." value={alleEmpfehlungen} color="#4CAF50" />
        <StatCard label="📚 Wissens-Einträge" value={wissensEintraege} color="#00BCD4" />
      </div>

      {/* Alerts */}
      {eingehend > 0 && (
        <div style={{
          backgroundColor: '#fff3e0', border: '1px solid #FF9900', borderRadius: '8px',
          padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '24px' }}>&#9888;&#65039;</span>
          <div>
            <strong>{eingehend} neue Anfrage(n)</strong> warten auf Überprüfung.{' '}
            <a href="/dashboard/anfragen" style={{ color: '#003366', fontWeight: 600 }}>Jetzt prüfen</a>
          </div>
        </div>
      )}

      {neueInteressenten > 0 && (
        <div style={{
          backgroundColor: '#e8f5e9', border: '1px solid #4CAF50', borderRadius: '8px',
          padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '24px' }}>&#128101;</span>
          <div>
            <strong>{neueInteressenten} neue Interessent(en)</strong> warten auf Freigabe.{' '}
            <a href="/dashboard/interessenten" style={{ color: '#003366', fontWeight: 600 }}>Jetzt prüfen</a>
          </div>
        </div>
      )}

      {/* Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Recent Anfragen */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0, color: '#003366', fontSize: '18px', marginBottom: '16px' }}>Letzte Anfragen</h2>
          {recentAnfragen.map((a) => (
            <div key={a.id} style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{getRichtungLabel(a.richtung)} {a.firmenname}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{a.branche} · {a.standort}</div>
              </div>
              <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getStatusColor(a.status) }}>
                {getStatusLabel(a.status)}
              </span>
            </div>
          ))}
          <a href="/dashboard/anfragen" style={{ display: 'block', textAlign: 'center', marginTop: '16px', color: '#003366', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
            Alle Anfragen anzeigen
          </a>
        </div>

        {/* Recent Interessenten */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0, color: '#003366', fontSize: '18px', marginBottom: '16px' }}>Letzte Interessenten</h2>
          {recentInteressenten.map((i) => (
            <div key={i.id} style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{i.firmenname}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>Fuer: {i.anfrageFirma} · {i.ansprechpartner}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {i.matchScore && (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: i.matchScore >= 80 ? '#4CAF50' : '#FF9900' }}>{i.matchScore}%</span>
                )}
                <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getStatusColor(i.status) }}>
                  {getStatusLabel(i.status)}
                </span>
              </div>
            </div>
          ))}
          <a href="/dashboard/interessenten" style={{ display: 'block', textAlign: 'center', marginTop: '16px', color: '#003366', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
            Alle Interessenten anzeigen
          </a>
        </div>
      </div>

      {/* Aktivitätenprotokoll */}
      <div style={{ marginTop: '24px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h2 style={{ marginTop: 0, color: '#003366', fontSize: '18px', marginBottom: '16px' }}>
          Aktivitätenprotokoll
        </h2>
        {aktivitaeten.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>
            Noch keine Aktivitäten in dieser Session. Bearbeite ein Unternehmen, lege einen Kontakt an oder ändere einen Status — alles erscheint hier.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aktivitaeten.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: '#f9f9f9', borderRadius: '6px', fontSize: '13px' }}>
                <span style={{ fontSize: '16px' }}>{a.typ === 'anlegen' ? '➕' : a.typ === 'status' ? '🔄' : '✏️'}</span>
                <span style={{ flex: 1, color: '#333' }}>{a.was}</span>
                <span style={{ fontSize: '11px', color: '#666' }}>{a.wer} · {a.zeit}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: `4px solid ${color}` }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color }}>{value}</p>
    </div>
  );
}
