// =============================================================
// EASY-B2B DATA STORE — gemeinsame Session-Datenschicht
// Liegt im Bereich „Easy-B2B" → bleibt über Unterbereiche hinweg erhalten.
// Echte Anfragen werden beim Start aus der Neon-DB geladen.
//
// Übernommen aus dem eigenständigen Easy-B2B-Dashboard (lib/store.tsx).
// Bewusst unverändert bis auf drei Punkte:
//   1. Die Next.js-Direktive 'use client' entfällt (Vite kennt sie nicht).
//   2. Die Endpunkte heißen jetzt /api/easyb2b-*, passend zur Namensgebung
//      der übrigen Spielbuch-Funktionen.
//   3. Ein Fehler beim Interessenten-Abruf setzt jetzt ebenfalls einen
//      sichtbaren Status statt nur eine Konsolenmeldung.
// =============================================================

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  MOCK_UNTERNEHMEN, MOCK_ANFRAGEN, MOCK_NETZWERKKONTAKTE,
  MOCK_INTERESSENTEN, MOCK_EVENTS, MOCK_SUCCESS_STORIES, MOCK_KONTAKTE, MOCK_FORMULARE,
  MOCK_MATCH_VORSCHLAEGE, MOCK_MATCHMAIL_VORLAGEN,
  type MockUnternehmen, type MockAnfrage, type MockNetzwerkkontakt,
  type AnfrageWorkflowStatus, type MockKontakt, type KontaktProjektZuordnung,
  type FormularVorlage, type MatchVorschlag, type MatchStatus, type DsgvoZustimmung,
  type MatchmailVorlage, type PruefPunkt, erstelleStandardPruefPunkte,
} from './mockdata';

export interface Aktivitaet {
  id: string;
  zeit: string;
  wer: string;       // Operator
  was: string;       // Beschreibung
  bezug: string;     // betroffene Entität
  typ: 'anlegen' | 'bearbeiten' | 'status';
}

// Zwischen-Entität: n:m zwischen Projekt (Anfrage) und Interessent
export interface ProjektInteressent {
  id: string;
  projektId: string;       // = anfrageId
  interessentId: string;
  zuordnungsart: 'automatisch' | 'manuell';
  status: string;          // vorgeschlagen | in_pruefung | freigegeben | abgelehnt | kontakt_hergestellt | abgeschlossen
  grund?: string;
  notiz?: string;
  erstelltAm: string;
  erstelltVon: string;
  letzteAktivitaet: string;
}

interface DashboardStore {
  // Editierbare Entitäten
  unternehmen: MockUnternehmen[];
  anfragen: MockAnfrage[];
  kontakte: MockNetzwerkkontakt[];
  dbLadenStatus: 'laden' | 'fertig' | 'fehler';

  // Mutatoren
  updateUnternehmen: (id: string, patch: Partial<MockUnternehmen>) => void;
  addUnternehmen: (u: MockUnternehmen) => void;
  updateAnfrage: (id: string, patch: Partial<MockAnfrage>) => void;
  updateKontakt: (id: string, patch: Partial<MockNetzwerkkontakt>) => void;
  addKontakt: (k: MockNetzwerkkontakt) => void;
  // Workflow-Actions (Anfrage → Unternehmen)
  legeUnternehmenAusAnfrageAn: (anfrageId: string) => string | null;
  verknuepfeMitUnternehmen: (anfrageId: string, unternehmensId: string) => void;
  setzeWorkflowStatus: (anfrageId: string, status: AnfrageWorkflowStatus) => void;
  // Prüfpunkte (Qualifizierung)
  updatePruefPunkt: (anfrageId: string, punktId: string, patch: Partial<PruefPunkt>) => void;
  initialisierePruefPunkte: (anfrageId: string) => void;
  // Geschäftskontakte
  geschaftskontakte: MockKontakt[];
  addGeschaftskontakt: (k: MockKontakt) => void;
  updateGeschaftskontakt: (id: string, patch: Partial<MockKontakt>) => void;
  addKontaktProjektZuordnung: (kontaktId: string, z: KontaktProjektZuordnung) => void;
  legeKontaktAusInteressentAn: (interessentId: string) => string | null;
  // Formular-Vorlagen
  formulare: FormularVorlage[];
  addFormular: (f: FormularVorlage) => void;
  updateFormular: (id: string, patch: Partial<FormularVorlage>) => void;
  deleteFormular: (id: string) => void;
  // Matchmaking-Vorlagen (E-Mail-Templates)
  matchmailVorlagen: MatchmailVorlage[];
  updateMatchmailVorlage: (id: string, patch: Partial<MatchmailVorlage>) => void;
  // Klärungsstand-Bestätigungen
  bestaetigeKlaerungsPunkt: (
    typ: 'anfrage' | 'interessent' | 'unternehmen',
    entitaetId: string,
    punktId: string,
    notiz?: string,
  ) => void;
  entferneKlaerungsBestaetigung: (
    typ: 'anfrage' | 'interessent' | 'unternehmen',
    entitaetId: string,
    punktId: string,
  ) => void;

  // Match-Vorschläge (DSGVO-konform)
  matchVorschlaege: MatchVorschlag[];
  addMatchVorschlag: (m: MatchVorschlag) => void;
  updateMatchVorschlag: (id: string, patch: Partial<MatchVorschlag>) => void;
  setzeMatchStatus: (id: string, status: MatchStatus) => void;
  dokumentiereZustimmung: (
    matchId: string,
    partei: 'suchender' | 'interessent',
    zustimmung: DsgvoZustimmung,
  ) => void;
  dokumentiereAblehnung: (matchId: string, partei: 'suchender' | 'interessent', grund?: string) => void;

  // Projektzuordnungen (n:m)
  zuordnungen: ProjektInteressent[];
  addZuordnung: (z: Omit<ProjektInteressent, 'id'>) => void;
  updateZuordnung: (id: string, patch: Partial<ProjektInteressent>) => void;

  // Aktivitätenprotokoll
  aktivitaeten: Aktivitaet[];
  logge: (was: string, bezug: string, typ?: Aktivitaet['typ']) => void;
}

// Seed: jede automatische Marktplatz-Zuordnung aus MOCK_INTERESSENTEN
function statusZuZuordnung(s: string): string {
  return {
    neu: 'vorgeschlagen', freigegeben: 'freigegeben', kontakt_laeuft: 'kontakt_hergestellt',
    erfolgreich: 'abgeschlossen', abgelehnt: 'abgelehnt', feedback_ausstehend: 'kontakt_hergestellt',
  }[s] || 'in_pruefung';
}

const SEED_ZUORDNUNGEN: ProjektInteressent[] = MOCK_INTERESSENTEN.map(i => ({
  id: `zo-${i.id}`,
  projektId: i.anfrageId,
  interessentId: i.id,
  zuordnungsart: 'automatisch' as const,
  status: statusZuZuordnung(i.status),
  grund: 'Über Marktplatz-Formular gemeldet',
  erstelltAm: i.createdAt,
  erstelltVon: 'System',
  letzteAktivitaet: i.createdAt,
}));

const Ctx = createContext<DashboardStore | null>(null);

let counter = 1000;
function neueId(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function DashboardStoreProvider({ children }: { children: ReactNode }) {
  const [unternehmen, setUnternehmen] = useState<MockUnternehmen[]>(MOCK_UNTERNEHMEN);
  const [anfragen, setAnfragen] = useState<MockAnfrage[]>(MOCK_ANFRAGEN);
  const [kontakte, setKontakte] = useState<MockNetzwerkkontakt[]>(MOCK_NETZWERKKONTAKTE);
  const [geschaftskontakte, setGeschaftskontakte] = useState<MockKontakt[]>(MOCK_KONTAKTE);
  const [formulare, setFormulare] = useState<FormularVorlage[]>(MOCK_FORMULARE);
  const [matchmailVorlagen, setMatchmailVorlagen] = useState<MatchmailVorlage[]>(MOCK_MATCHMAIL_VORLAGEN);
  const [zuordnungen, setZuordnungen] = useState<ProjektInteressent[]>(SEED_ZUORDNUNGEN);
  const [matchVorschlaege, setMatchVorschlaege] = useState<MatchVorschlag[]>(MOCK_MATCH_VORSCHLAEGE);
  const [aktivitaeten, setAktivitaeten] = useState<Aktivitaet[]>([]);
  const [dbLadenStatus, setDbLadenStatus] = useState<'laden' | 'fertig' | 'fehler'>('laden');

  // Echte Anfragen + Interessenten aus Neon-DB laden
  useEffect(() => {
    // Anfragen laden
    fetch('/api/easyb2b-anfragen')
      .then(r => r.json())
      .then((dbAnfragen: MockAnfrage[]) => {
        if (Array.isArray(dbAnfragen) && dbAnfragen.length > 0) {
          setAnfragen(prev => {
            // Deduplizieren: DB-Daten haben Vorrang, Mock-Daten bleiben für nicht in DB vorhandene
            const dbIds = new Set(dbAnfragen.map(a => a.anzeigenId));
            const nurMock = prev.filter(a => !dbIds.has(a.anzeigenId));
            return [...dbAnfragen, ...nurMock];
          });
          setDbLadenStatus('fertig');
        } else {
          setDbLadenStatus('fertig');
        }
      })
      .catch(() => setDbLadenStatus('fehler'));

    // Interessenten aus DB laden und als Zuordnungen integrieren
    fetch('/api/easyb2b-interessenten')
      .then(r => r.json())
      .then((dbInteressenten: any[]) => {
        if (!Array.isArray(dbInteressenten) || dbInteressenten.length === 0) return;
        setZuordnungen(prev => {
          const vorhandeneIds = new Set(prev.map(z => z.interessentId));
          const neueZuordnungen = dbInteressenten
            .filter(i => !vorhandeneIds.has(i.id))
            .map(i => ({
              id: `zo-db-${i.id}`,
              projektId: i.anfrageId,
              interessentId: i.id,
              zuordnungsart: 'automatisch' as const,
              status: statusZuZuordnung(i.status),
              grund: 'Über Homepage-Formular eingegangen',
              erstelltAm: i.createdAt,
              erstelltVon: 'System',
              letzteAktivitaet: i.createdAt,
            }));
          return [...prev, ...neueZuordnungen];
        });
      })
      .catch(() => {
        // Bisher nur eine Konsolenmeldung – dadurch blieb ein Ausfall der
        // Interessenten unbemerkt, obwohl die Anfragen scheinbar geladen waren.
        console.warn('[Easy-B2B] Interessenten aus der Datenbank konnten nicht geladen werden');
        setDbLadenStatus('fehler');
      });
  }, []);

  const logge = (was: string, bezug: string, typ: Aktivitaet['typ'] = 'bearbeiten') => {
    setAktivitaeten(prev => [{
      id: neueId('act'),
      zeit: 'gerade eben',
      wer: 'Operator',
      was, bezug, typ,
    }, ...prev].slice(0, 50));
  };

  const updateUnternehmen = (id: string, patch: Partial<MockUnternehmen>) => {
    setUnternehmen(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  };
  const addUnternehmen = (u: MockUnternehmen) => setUnternehmen(prev => [u, ...prev]);

  const updateAnfrage = (id: string, patch: Partial<MockAnfrage>) => {
    setAnfragen(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  const updateKontakt = (id: string, patch: Partial<MockNetzwerkkontakt>) => {
    setKontakte(prev => prev.map(k => k.id === id ? { ...k, ...patch } : k));
  };
  const addKontakt = (k: MockNetzwerkkontakt) => setKontakte(prev => [k, ...prev]);

  const addZuordnung = (z: Omit<ProjektInteressent, 'id'>) => {
    setZuordnungen(prev => [{ ...z, id: neueId('zo') }, ...prev]);
  };
  const updateZuordnung = (id: string, patch: Partial<ProjektInteressent>) => {
    setZuordnungen(prev => prev.map(z => z.id === id ? { ...z, ...patch, letzteAktivitaet: 'gerade eben' } : z));
  };

  // ── Workflow-Actions ──────────────────────────────────────────

  const legeUnternehmenAusAnfrageAn = (anfrageId: string): string | null => {
    const anfrage = anfragen.find(a => a.id === anfrageId);
    if (!anfrage) return null;
    const neueId_ = neueId('unt');
    const neuesUnternehmen: MockUnternehmen = {
      id: neueId_,
      anfrageId,
      firmenname: anfrage.firmenname,
      land: anfrage.richtung === 'dk_de' ? 'daenemark' : 'deutschland',
      standort: anfrage.standort,
      branche: anfrage.branche,
      groesse: 'klein',
      ansprechpartner: anfrage.ansprechpartner,
      email: anfrage.email,
      telefon: anfrage.telefon,
      sprachen: anfrage.sprachen || [],
      kurzbeschreibung: anfrage.beschreibung?.slice(0, 200) || '',
      persoenlichesGespraech: false,
      websiteGeprueft: false,
      linkedinGeprueft: false,
      empfehlungVorhanden: false,
      netzwerkStatus: 'interessiert',
      erstkontakt: new Date().toISOString().split('T')[0],
      letzteAktivitaet: new Date().toISOString().split('T')[0],
      anfrageCount: 1,
      interessentCount: 0,
      successStories: 0,
      events: [],
    };
    setUnternehmen(prev => [neuesUnternehmen, ...prev]);
    setAnfragen(prev => prev.map(a => a.id === anfrageId
      ? { ...a, unternehmensId: neueId_, workflowStatus: 'unternehmen_angelegt' as const }
      : a
    ));
    logge(`Unternehmen "${anfrage.firmenname}" aus Anfrage angelegt`, anfrage.anzeigenId || anfrageId, 'anlegen');
    return neueId_;
  };

  const verknuepfeMitUnternehmen = (anfrageId: string, unternehmensId: string) => {
    const anfrage = anfragen.find(a => a.id === anfrageId);
    setAnfragen(prev => prev.map(a => a.id === anfrageId
      ? { ...a, unternehmensId, workflowStatus: 'unternehmen_angelegt' as const }
      : a
    ));
    if (anfrage) logge(`Anfrage mit bestehendem Unternehmen verknüpft`, anfrage.anzeigenId || anfrageId, 'bearbeiten');
  };

  const setzeWorkflowStatus = (anfrageId: string, status: AnfrageWorkflowStatus) => {
    const anfrage = anfragen.find(a => a.id === anfrageId);
    setAnfragen(prev => prev.map(a => a.id === anfrageId ? { ...a, workflowStatus: status } : a));
    if (anfrage) logge(`Workflow-Status: ${status}`, anfrage.anzeigenId || anfrageId, 'status');
  };

  // ── Prüfpunkte (Qualifizierung) ───────────────────────────────

  const updatePruefPunkt = (anfrageId: string, punktId: string, patch: Partial<PruefPunkt>) => {
    setAnfragen(prev => prev.map(a => {
      if (a.id !== anfrageId) return a;
      const punkte = (a.pruefPunkte || erstelleStandardPruefPunkte()).map(p =>
        p.id === punktId ? { ...p, ...patch } : p
      );
      return { ...a, pruefPunkte: punkte };
    }));
  };

  const initialisierePruefPunkte = (anfrageId: string) => {
    setAnfragen(prev => prev.map(a => {
      if (a.id !== anfrageId || a.pruefPunkte) return a;
      return { ...a, pruefPunkte: erstelleStandardPruefPunkte() };
    }));
    const anfrage = anfragen.find(a => a.id === anfrageId);
    if (anfrage) logge('Prüfpunkte initialisiert', anfrage.anzeigenId || anfrageId, 'anlegen');
  };

  // ── Geschäftskontakte ──────────────────────────────────────────

  const addGeschaftskontakt = (k: MockKontakt) =>
    setGeschaftskontakte(prev => [k, ...prev]);

  const updateGeschaftskontakt = (id: string, patch: Partial<MockKontakt>) =>
    setGeschaftskontakte(prev => prev.map(k => k.id === id ? { ...k, ...patch } : k));

  const addKontaktProjektZuordnung = (kontaktId: string, z: KontaktProjektZuordnung) => {
    setGeschaftskontakte(prev => prev.map(k =>
      k.id === kontaktId ? { ...k, projektZuordnungen: [...k.projektZuordnungen, z] } : k
    ));
    logge(`Kontakt Projekt zugeordnet`, kontaktId, 'bearbeiten');
  };

  const legeKontaktAusInteressentAn = (interessentId: string): string | null => {
    const interessent = MOCK_INTERESSENTEN.find(i => i.id === interessentId);
    if (!interessent) return null;
    const neueId_ = neueId('kon');
    const kontakt: MockKontakt = {
      id: neueId_,
      quelleTyp: 'interessent',
      interessentId,
      anfrageId: interessent.anfrageId,
      firmenname: interessent.firmenname,
      ansprechpartner: interessent.ansprechpartner,
      email: interessent.email,
      telefon: interessent.telefon,
      website: interessent.website,
      linkedin: interessent.linkedin,
      land: interessent.land,
      region: interessent.region,
      branche: undefined,
      sprachen: interessent.sprachen,
      status: 'aktiv',
      createdAt: new Date().toISOString().split('T')[0],
      interneNotiz: interessent.gespraechsnotiz,
      projektZuordnungen: interessent.anfrageId ? [{
        id: neueId('kpz'),
        projektId: interessent.anfrageId,
        status: 'freigegeben' as const,
        notiz: 'Aus Interessentenformular konvertiert',
        erstelltAm: new Date().toISOString().split('T')[0],
        erstelltVon: 'Operator',
      }] : [],
    };
    setGeschaftskontakte(prev => [kontakt, ...prev]);
    logge(`Kontakt "${interessent.firmenname}" aus Interessent erstellt`, interessent.firmenname, 'anlegen');
    return neueId_;
  };

  // ── Formular-Vorlagen ──────────────────────────────────────────

  const addFormular = (f: FormularVorlage) => setFormulare(prev => [f, ...prev]);
  const updateFormular = (id: string, patch: Partial<FormularVorlage>) =>
    setFormulare(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  const deleteFormular = (id: string) =>
    setFormulare(prev => prev.filter(f => f.id !== id));

  // ── Matchmaking-Vorlagen ──────────────────────────────────────
  const updateMatchmailVorlage = (id: string, patch: Partial<MatchmailVorlage>) =>
    setMatchmailVorlagen(prev => prev.map(v => v.id === id ? { ...v, ...patch, letzteBearbeitung: new Date().toISOString().split('T')[0] } : v));

  // ── Match-Vorschläge (DSGVO-konform) ─────────────────────────

  const addMatchVorschlag = (m: MatchVorschlag) => {
    setMatchVorschlaege(prev => [m, ...prev]);
    logge(`Match-Vorschlag erstellt: ${m.interessentFirma} ↔ ${m.anfrageFirma}`, m.anfrageId, 'anlegen');
  };

  const updateMatchVorschlag = (id: string, patch: Partial<MatchVorschlag>) => {
    setMatchVorschlaege(prev => prev.map(m => m.id === id ? { ...m, ...patch, letzteAenderung: new Date().toISOString().split('T')[0] } : m));
  };

  const setzeMatchStatus = (id: string, status: MatchStatus) => {
    setMatchVorschlaege(prev => prev.map(m => m.id === id ? { ...m, status, letzteAenderung: new Date().toISOString().split('T')[0] } : m));
    const match = matchVorschlaege.find(m => m.id === id);
    if (match) logge(`Match-Status: ${status}`, `${match.anfrageFirma} ↔ ${match.interessentFirma}`, 'status');
  };

  const dokumentiereZustimmung = (
    matchId: string,
    partei: 'suchender' | 'interessent',
    zustimmung: DsgvoZustimmung,
  ) => {
    setMatchVorschlaege(prev => prev.map(m => {
      if (m.id !== matchId) return m;
      const updated = { ...m, letzteAenderung: new Date().toISOString().split('T')[0] };
      if (partei === 'suchender') {
        updated.zustimmungSuchender = zustimmung;
        // Prüfe ob der Interessent bereits zugestimmt hat
        updated.status = m.zustimmungInteressent ? 'beide_zugestimmt' : 'suchender_zugestimmt';
      } else {
        updated.zustimmungInteressent = zustimmung;
        updated.status = m.zustimmungSuchender ? 'beide_zugestimmt' : 'interessent_zugestimmt';
      }
      return updated;
    }));
    const match = matchVorschlaege.find(m => m.id === matchId);
    if (match) logge(`DSGVO-Zustimmung: ${zustimmung.unternehmen} (${partei})`, `${match.anfrageFirma} ↔ ${match.interessentFirma}`, 'status');
  };

  const dokumentiereAblehnung = (matchId: string, partei: 'suchender' | 'interessent', grund?: string) => {
    const status: MatchStatus = partei === 'suchender' ? 'abgelehnt_suchender' : 'abgelehnt_interessent';
    setMatchVorschlaege(prev => prev.map(m => m.id === matchId ? { ...m, status, ablehnungGrund: grund, letzteAenderung: new Date().toISOString().split('T')[0] } : m));
    const match = matchVorschlaege.find(m => m.id === matchId);
    if (match) logge(`Match abgelehnt (${partei}): ${grund || 'Kein Grund'}`, `${match.anfrageFirma} ↔ ${match.interessentFirma}`, 'status');
  };

  // ── Klärungsstand-Bestätigungen ───────────────────────────────

  const bestaetigeKlaerungsPunkt = (
    typ: 'anfrage' | 'interessent' | 'unternehmen',
    entitaetId: string,
    punktId: string,
    notiz?: string,
  ) => {
    const eintrag = {
      notiz,
      bestaetigtVon: 'Operator',
      bestaetigtAm: new Date().toISOString().split('T')[0],
    };
    if (typ === 'anfrage') {
      setAnfragen(prev => prev.map(a => a.id === entitaetId
        ? { ...a, klaerungsBestaetigungen: { ...(a.klaerungsBestaetigungen || {}), [punktId]: eintrag } }
        : a
      ));
      const a = anfragen.find(x => x.id === entitaetId);
      if (a) logge(`Klärungspunkt bestätigt: ${punktId}`, a.anzeigenId || entitaetId, 'bearbeiten');
    } else if (typ === 'unternehmen') {
      setUnternehmen(prev => prev.map(u => u.id === entitaetId
        ? { ...u, klaerungsBestaetigungen: { ...(u.klaerungsBestaetigungen || {}), [punktId]: eintrag } }
        : u
      ));
      const u = unternehmen.find(x => x.id === entitaetId);
      if (u) logge(`Klärungspunkt bestätigt: ${punktId}`, u.firmenname, 'bearbeiten');
    } else if (typ === 'interessent') {
      // Interessenten sind aktuell MOCK_INTERESSENTEN (nicht im Store) — wir loggen nur,
      // die UI hält die Bestätigungen lokal. Folgeschritt: Interessenten in Store überführen.
      logge(`Klärungspunkt bestätigt (Interessent ${entitaetId}): ${punktId}`, entitaetId, 'bearbeiten');
    }
  };

  const entferneKlaerungsBestaetigung = (
    typ: 'anfrage' | 'interessent' | 'unternehmen',
    entitaetId: string,
    punktId: string,
  ) => {
    if (typ === 'anfrage') {
      setAnfragen(prev => prev.map(a => {
        if (a.id !== entitaetId) return a;
        const next = { ...(a.klaerungsBestaetigungen || {}) };
        delete next[punktId];
        return { ...a, klaerungsBestaetigungen: next };
      }));
    } else if (typ === 'unternehmen') {
      setUnternehmen(prev => prev.map(u => {
        if (u.id !== entitaetId) return u;
        const next = { ...(u.klaerungsBestaetigungen || {}) };
        delete next[punktId];
        return { ...u, klaerungsBestaetigungen: next };
      }));
    }
  };

  return (
    <Ctx.Provider value={{
      unternehmen, anfragen, kontakte,
      updateUnternehmen, addUnternehmen, updateAnfrage, updateKontakt, addKontakt,
      zuordnungen, addZuordnung, updateZuordnung,
      aktivitaeten, logge, dbLadenStatus,
      legeUnternehmenAusAnfrageAn, verknuepfeMitUnternehmen, setzeWorkflowStatus,
      updatePruefPunkt, initialisierePruefPunkte,
      geschaftskontakte, addGeschaftskontakt, updateGeschaftskontakt,
      addKontaktProjektZuordnung, legeKontaktAusInteressentAn,
      formulare, addFormular, updateFormular, deleteFormular,
      matchmailVorlagen, updateMatchmailVorlage,
      bestaetigeKlaerungsPunkt, entferneKlaerungsBestaetigung,
      matchVorschlaege, addMatchVorschlag, updateMatchVorschlag,
      setzeMatchStatus, dokumentiereZustimmung, dokumentiereAblehnung,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): DashboardStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore muss innerhalb von DashboardStoreProvider verwendet werden');
  return ctx;
}

export function neueEntityId(prefix: string) {
  return neueId(prefix);
}

// ─── GLOBALE SUCHE ────────────────────────────────────────────

export interface Suchergebnis {
  modul: string;
  modulIcon: string;
  titel: string;
  untertitel: string;
  href: string;
  badge?: string;
}

export function globaleSuche(query: string, store: DashboardStore): Suchergebnis[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const treffer: Suchergebnis[] = [];
  const match = (...felder: (string | undefined)[]) => felder.some(f => f?.toLowerCase().includes(q));

  // Unternehmen
  store.unternehmen.forEach(u => {
    if (match(u.firmenname, u.ansprechpartner, u.website, u.branche, u.email, u.standort)) {
      treffer.push({
        modul: 'Unternehmen', modulIcon: '🏢',
        titel: u.firmenname, untertitel: `${u.ansprechpartner} · ${u.branche || ''} · ${u.standort}`,
        href: '/dashboard/unternehmen', badge: u.land === 'deutschland' ? '🇩🇪' : '🇩🇰',
      });
    }
  });

  // Anfragen
  store.anfragen.forEach(a => {
    if (match(a.firmenname, a.anzeigenId, a.beschreibung, a.ziel, a.ansprechpartner, a.email)) {
      treffer.push({
        modul: 'Anfrage', modulIcon: '📋',
        titel: `${a.anzeigenId} – ${a.firmenname}`, untertitel: a.ziel,
        href: '/dashboard/anfragen', badge: a.status,
      });
    }
  });

  // Interessenten (read-only)
  MOCK_INTERESSENTEN.forEach(i => {
    if (match(i.firmenname, i.ansprechpartner, i.email, i.telefon, i.anfrageFirma)) {
      treffer.push({
        modul: 'Interessent', modulIcon: '👥',
        titel: i.firmenname, untertitel: `${i.ansprechpartner} · Interesse an ${i.anfrageFirma}`,
        href: '/dashboard/interessenten', badge: i.status,
      });
    }
  });

  // Netzwerkkontakte
  store.kontakte.forEach(k => {
    if (match(k.name, k.organisation, k.email, k.telefon, k.region, k.branche)) {
      treffer.push({
        modul: 'Netzwerk', modulIcon: '🕸',
        titel: k.name, untertitel: `${k.position || ''} · ${k.organisation || ''}`,
        href: '/dashboard/netzwerk',
      });
    }
  });

  // Events
  MOCK_EVENTS.forEach(e => {
    const teilnehmerMatch = e.teilnehmer.some(t => match(t.firmenname, t.ansprechpartner));
    if (match(e.titel, e.untertitel, e.ort) || teilnehmerMatch) {
      treffer.push({
        modul: 'Event', modulIcon: '🎤',
        titel: e.titel, untertitel: `${e.datum} · ${e.ort}${teilnehmerMatch ? ' · Teilnehmer-Treffer' : ''}`,
        href: '/dashboard/events', badge: e.status,
      });
    }
  });

  // Success Stories
  MOCK_SUCCESS_STORIES.forEach(s => {
    if (match(s.titel, s.firma1Name, s.firma2Name, s.kurzbeschreibung)) {
      treffer.push({
        modul: 'Success Story', modulIcon: '⭐',
        titel: s.titel, untertitel: `${s.firma1Name} ↔ ${s.firma2Name}`,
        href: '/dashboard/success-stories',
      });
    }
  });

  return treffer;
}
