# Dashboard-Zusammenfassung für Prozess-Review
_Erstellt 2026-05-29 – für Analyse in einem separaten Chat_

---

## 1. Was das System ist

„Jan's Spielbuch" ist ein **mandantenbasiertes Jahresabschluss-Dashboard** für einen Steuerberater (SKR03 + SKR04, EÜR-lastig, GuV → Bilanz-Workflow). Es läuft als PWA im Browser, wird lokal mit Vite/React gebaut und ist über Supabase cloud-persistent.

**Kein externes Kanzleisystem** – vollständig eigenentwickelt, kein DATEV-Anbindung, kein API zu Steuersoftware.

---

## 2. Technischer Stack

| Bereich | Technologie |
|---|---|
| Frontend | React 18, Vite, JSX (kein TypeScript) |
| Auth | Supabase Auth (E-Mail/Passwort) |
| Persistenz | Supabase Storage (cloud) + localStorage (Fallback) |
| E-Mail-Abruf | Zwei eigene Postfächer (Hostinger + Strato) via `/api/fetch-emails` |
| KI | Claude API (optional, API-Key cloud-gespeichert) |
| OneDrive | Microsoft OAuth, Datei-Upload aus Dashboard |
| PWA | Vite PWA Plugin, Service Worker, 30-min Auto-Snapshot |

---

## 3. Architektur / Datenfluss

```
App.jsx (Root-State)
├── clients[]           ← Haupt-Datensatz, pro Mandant ein Objekt
├── termine[]           ← Globale Terminliste (cloud-persistent)
├── aufgabenListe[]     ← Manuelle globale Aufgaben (cloud-persistent)
├── checklistenTypen    ← Checklisten-Templates (cloud-persistent)
├── vorlagen            ← Textvorlagen (cloud-persistent)
├── emailVorlagen[]     ← E-Mail-Vorlagen (cloud-persistent)
├── emailSignaturen[]   ← Signaturen (cloud-persistent)
├── formVorlagen[]      ← Formular-Templates (cloud-persistent)
├── unbekannteEmails[]  ← Eingehende E-Mails ohne Mandant-Zuordnung
└── onedriveTokens      ← MS OAuth Tokens (cloud-persistent)
```

**Speicher-Mechanismus:**
- Alle State-Änderungen → `useEffect` → `cloudSave()` (debounced 1,5 s)
- Tab-/Fenster-Schließen → `beforeunload` → `cloudSaveNow()` (keepalive fetch)
- Alle 30 min → `cloudSnapshot()` (Versionierungs-Backup in Supabase)
- Kein Redux, kein Context API – alles in App.jsx, `updateClient(id, patch)` als einzige Schreibfunktion

---

## 4. Datenmodell – Client-Objekt (wichtigste Felder)

```js
{
  id, name, mandantennummer, mandantennummer2, mandantennummer3,
  rechtsform, gewinnermittlung,            // EÜR / Bilanz
  veranlagungsjahr, veranlagungsjahr2, veranlagungsjahr3,
  mandatstyp,                              // 'intern' | 'extern'
  archiviert, archivDatum, archivSummary,

  // Jahresabschluss-Workflow
  inBearbeitung, abschlussFertig, abschlussFertigDatum,
  steGesendetDatum, unterschriftDatum,
  faGeplantDatum, faUebermittelt, faUebermitteltDatum,
  manuellerStatus,                         // override für Ampel-Status

  // Aufträge (Kern-Feature)
  auftraege: [                             // Einzel- und Serienaufträge
    {
      id, typ, bezeichnung, jahr, monat, frist,
      status,                              // 'offen' | 'in_bearbeitung' | 'erledigt'
      erledigtAm, notiz, hinweise[], erstelltAm,
      // --- nur bei Serienaufträgen ---
      istSerie: true,
      serie: {
        startDatum, intervallTyp,          // 'tage'|'wochen'|'monate'|'quartale'|'jahre'
        intervallWert, endTyp,             // 'kein'|'datum'|'anzahl'
        endDatum, endAnzahl,
      },
      instanzen: {                         // { 'YYYY-MM-DD': { status, erledigtAm } }
        '2025-01-01': { status:'erledigt', erledigtAm: '...' },
        '2025-02-01': { status:'offen', erledigtAm: null },
      },
    }
  ],

  // Rückfragen (Mandantenkommunikation)
  rueckfragen: [{ id, text, buchungskonto, antwort, beantwortet, beantwortetAm, quelleTypId?, quelleItemId? }],
  rueckfragenSendungen: ['', '', '', ''],  // bis zu 4 Sendedaten

  // Kommunikation / E-Mail
  kommunikation: {
    standardAbsender: '',
    events: [{ id, typ, absender, empfaenger, betreff, text, html, anlagen[], status, erstelltAm, sourceUid, sourceAccount }]
  },

  // Checklisten
  checklisten: { [typId]: { [itemId]: { erledigt, notiz, datum } } },
  abschluss:   { punkte:[], checkliste: null },

  // Steuerarten / Lohn / FIBU
  ustZahlerTyp,                            // 'keine'|'monatlich'|'quartalsweise'|'jährlich'
  lohnAktiv, lohnIntervall, lohnInUebersicht,
  lohnSerie: { aktiv, startDatum, frequenz, faelligTag, endDatum, intervallTyp, intervallWert },
  fibuAktiv, fibuInUebersicht,
  fibuSerie: { aktiv, startDatum, frequenz, faelligTag, endDatum, intervallTyp, intervallWert },
  fibuNotizen: [],

  // SuSa
  susa: { typ, kontorahmen, konten:[], importDatum, dateiname },

  // Rechner / Berechnungen
  berechnungen: { kfz:[], arbeitszimmer:[], reisekosten:[] },
  rechner: [],                             // Mandantenspez. Rechner

  // Sonstiges
  notizen, steuernummer, unternehmensgegenstand,
  beratung: { branche, ergebnis, erstelltAm },
  erinnerungen: [{ id, datum, text }],
  kontakte: [{ id, name, rolle, email, telefon }],
  gesellschafter: [], geschaeftsfuehrer: [],
  honorare: [],
  struktur: null,                          // Abschluss-Strukturbaum
  est: {}, ust: {},
  steuerarten: {},
  aufgabenStatus: {},
  jaAuftraege: [], zusatzaufgaben: [],
  aufgaben: [],
}
```

---

## 5. Navigation / Hauptansichten

### Linke Sidebar
- **Mandanten-Liste** (ClientTable) mit Filter: Alle / Aktiv / Rückfragen / Erledigt + Intern/Extern + Freitext-Suche
- Sondereinträge: **📋 Aufgaben-Übersicht** (`__todo__`) · **💰 Honorar-Übersicht** (`__budget__`)
- Einklappbar

### Startseite (kein Mandant gewählt)
- `StartseiteHome`: Dashboard-Übersicht, offene E-Mails, Aufgaben-Kurzübersicht

### Detailansicht (15 Tabs pro Mandant)

| Tab | Inhalt |
|---|---|
| 0 🏠 Dashboard | Übersicht: Status, Fortschritt, Rückfragen, Erinnerungen |
| 1 🗂 Stammdaten | Editierbare Grunddaten (Name, Rechtsform, VJ, Kontakte, …) |
| 2 📊 Historie | Stand der Arbeit, offene Punkte, Hinweise |
| 3 📁 Abschluss | Checkliste + Prüfblöcke (Fahrzeuge, Bewirtung, Darlehen, USt, Steuer, …) |
| 4 💼 Lohn | Lohnabrechnung-Status + Serienlogik |
| 5 🧠 Beratung | KI-gestützte Branchenanalyse (Claude API) |
| 6 ✉️ Nachrichten | Kommunikations-Journal, E-Mail senden/empfangen, Vorlagen |
| 7 📂 Dokumente | OneDrive-Integration, Datei-Upload, Senden als Anhang |
| 8 📊 ESt | Einkommensteuer-Modul |
| 9 🧾 USt | Umsatzsteuer-Modul |
| 10 📋 Formulare | Eigene Formular-Templates (öffentliche URL per Token) |
| 11 📊 SuSa | SuSa-Import (CSV), Kontenanalyse, KI-Prüfung |
| 12 📒 FIBU | FiBu-Modul |
| 13 📋 Aufträge | Auftrags-Management (Einzel + Serienaufträge) |
| 14 💰 Honorare | Honorarverwaltung |

---

## 6. Auftrags-System (Feature 5 – Serienaufträge)

### Auftragstypen (`AUFTRAGS_TYP_CFG`)
`fibu`, `lohn`, `ust`, `jahresabschluss`, `est`, `beratung`, `freitext`

### Serienlogik
- **Ein** `auftraege`-Eintrag mit `istSerie:true` + `serie`-Config
- `generateSerieInstanzen(au, maxInstances=300)` generiert virtuelle Instanzen dynamisch:
  - Endtyp `kein`: bis 93 Tage in die Zukunft
  - Endtyp `datum`: bis `serie.endDatum`
  - Endtyp `anzahl`: `serie.endAnzahl` Instanzen
- Per-Instance-Status in `instanzen`-Map: `{ 'YYYY-MM-DD': { status, erledigtAm } }`
- Intervalltypen: tage / wochen / monate / quartale / jahre mit beliebigem `intervallWert`

### Status-Cycle
`offen` → `in_bearbeitung` → `erledigt` → `offen` (Loop per Klick)

---

## 7. Aufgaben-/Auftragsübersicht (GlobalTodoView)

Globale Übersicht aller Aufträge **über alle Mandanten** hinweg.

### Ansichtsmodi
| Modus | Beschreibung |
|---|---|
| 📅 Monat | Tabelle gefiltert nach Monat/Jahr + Monats-Chips |
| 📆 Woche | 7-Spalten-Layout Mo–So mit WeekCards |
| 🗓 Tag | Tages-Tabelle mit zwei Sektionen |

### Carry-Forward (Tagesansicht)
- Überfällige, nicht erledigte Aufgaben erscheinen automatisch im heutigen und zukünftigen Tagen
- **📌 Mitgenommene Aufgaben** (rot hinterlegt) → zeigt „⚠ seit X Tagen offen" + ursprüngliche Frist
- **📅 Heute fällig** → normale Aufgaben des Tages
- Wochenansicht: überfällige Karten mit rotem linken Rand + `⚠Xd`-Label

### Filter
- Typ-Filter (alle / fibu / lohn / …)
- Status-Filter (Aktiv / Offen / In Bearb. / Erledigt / Alle)
- Mandatstyp-Filter (Alle / 🏢 Extern / 🏠 Intern)
- Navigation: Prev/Next/Heute + Datepicker

### Schnell-Anlegen
- Klick auf „+ Auftrag" im Wochen-/Tagesslot → Modal → erstellt Einzelauftrag mit Frist auf diesen Tag

---

## 8. E-Mail-System

- **Polling** alle 15 min gegen zwei Postfächer (`/api/fetch-emails?account=hostinger|strato`)
- **Automatische Zuordnung** per Kontakt-E-Mail-Index (Mandant → Kommunikations-Tab)
- **Ungeklärter Posteingang** (📥-Badge): E-Mails ohne Mandant-Match → manuell zuordnen oder ignorieren
- **Auto-Recheck**: wenn Mandant-Kontakte geändert → prüft sofort ob ungeklärte E-Mails jetzt zuordenbar
- Volltext-E-Mail-Antwort inkl. CC/BCC, Anhänge (OneDrive), Signaturen, Vorlagen
- Alle Events bleiben im `kommunikation.events[]`-Array persistiert

---

## 9. Checklisten-System

- Admin-Editor: Checklisten-Typen mit Items, Priorität, Notiz-Feldern
- Pro Mandant: Fortschritt in `client.checklisten[typId][itemId]`
- Rückfragen aus Checkliste: erstellt Rückfrage mit `quelleTypId/quelleItemId` → bidirektionale Sync beim Abhaken
- Prüfblöcke im Abschluss-Tab: Fahrzeuge, Bewirtung, Darlehen, USt, Steuer, Gesellschafter, PWB/RAP, Verbindlichkeiten

---

## 10. Bekannte technische Schulden / Optimierungspotenzial

| Bereich | Problem |
|---|---|
| App.jsx | ~1.300 Zeilen, alle State + alle CRUD-Funktionen an einem Ort – keine Trennung |
| Kein Context | Props werden 3-4 Ebenen tief durchgereicht (`updateClient` → DetailView → Tab → Sub-Tab) |
| Keine Tests | Keinerlei Unit- oder Integrationstests |
| Bundle-Größe | ~1,7 MB (unkomprimiert) – keine Code-Splitting / Lazy Loading |
| SuSa | `eval()` in SusaTab.jsx (Sicherheitswarnung, pre-existing) |
| E-Mail-Polling | Kein Webhook/Push, nur Pull alle 15 min – Latenz bei schnellen Antworten |
| Keine Typsicherheit | JSX ohne TypeScript – Datenstruktur nur implizit durch `migrateClient()` dokumentiert |
| Duplikate | `lohnSerie` und `fibuSerie` haben ähnliche Struktur wie `auftraege[].serie` – nicht vereinheitlicht |
| Rückfragen-Sendungen | `rueckfragenSendungen[4]` und `rueckfragen[]` sind zwei separate Datensätze – historisch gewachsen |
| Termine | `KalenderSection.jsx` importiert, aber Kalender-Spalte im Layout ausgeblendet (Code-Leiche) |

---

## 11. Nicht implementiert / mögliche Erweiterungen

- DATEV-Export / CSV-Export der Aufträge
- Mandantenportal (Mandant kann selbst Unterlagen hochladen)
- Automatische Frist-Erinnerungen per E-Mail
- Rollenkonzept (nur ein User = der Steuerberater)
- Reporting / Statistik-Export (Honorare, Erledigungsquoten)
- Drag & Drop in Wochen-/Monatsansicht
- Mehrsprachigkeit

---

## 12. Wichtige Hilfsfunktionen (für neue Features relevant)

```js
// AuftraegeTab.jsx – exportiert
generateSerieInstanzen(au, maxInstances)   // → virtuelle Instanzen[]
addIntervalDate(date, typ, wert)           // → Date
intervallLabel(serie)                      // → 'Monatlich' | 'Alle 3 Monate' etc.
AUFTRAGS_TYP_CFG                           // icon, label, color, bg, border pro Typ
AUFTRAGS_STATUS_CFG                        // icon, label, color, bg, border pro Status

// GlobalTodoView.jsx – intern
getExactDate(au)       // → ISO-String oder null (für Wochen-/Tagesansicht)
getDisplayPeriod(au)   // → { monat, jahr } (für Monatsansicht)
daysSince(dateStr)     // → Anzahl Tage, seit denen die Aufgabe überfällig ist
getWeekStart(date)     // → Montag der Woche
generateId()           // → eindeutige ID (in App.jsx)
migrateClient(c)       // → Client-Objekt mit allen Defaults
```

---

_Ende der Zusammenfassung. Diese Datei bitte nicht committen – nur für internen Review-Einsatz._
