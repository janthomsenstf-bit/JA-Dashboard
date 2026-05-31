# Dashboard-Refactoring – Tracking-Dokument

Erstellt nach dem Optimierungsdialog (Mai 2026).
Dieses Dokument gilt als Gedächtnis für unterbrochene Sitzungen.

---

## Kontext

Benutzer-Workflow: Mandant → Aufträge → Nachrichten → Dokumente → Honorare
Ziel: 15 Tabs → 7 Tabs, Doppelstrukturen beseitigen, Design klären

---

## PRIORITÄT 1 – Quick Wins (wenig Aufwand, sofortige Wirkung)

### 1A – Tote Dateien löschen
Dateien existieren im Code, werden nirgends eingebunden.

- [x] `src/components/detail/AITab.jsx` – gelöscht
- [x] `src/components/detail/EmailTab.jsx` – gelöscht
- [x] `src/components/detail/NotesTab.jsx` – gelöscht
- [x] `src/components/detail/OffenePunkteTab.jsx` – gelöscht
- [x] `src/components/detail/OverviewTab.jsx` – gelöscht
- [x] `src/components/detail/StatusTab.jsx` – gelöscht
- [x] `src/components/detail/HinweiseTab.jsx` – gelöscht
- [x] `src/components/detail/StandListTab.jsx` – gelöscht
- [x] `src/components/detail/FiBuJATab.jsx` – gelöscht
- [x] `src/components/detail/AufgabenTab.jsx` – gelöscht (nie in DetailView montiert, Benutzer braucht es nicht)

### 1B – Tab-Navigation: 15 → 7 Tabs, neue Reihenfolge

Neue Reihenfolge (nach Workflow-Priorität):
```
0: Mandant     (war: AuftragTab, Tab 1)
1: Aufträge    (war: AuftraegeTab, Tab 13)
2: Nachrichten (war: KommunikationTab, Tab 6)
3: Dokumente   (war: DokumenteTab, Tab 7)
4: Honorare    (war: HonorareTab, Tab 14)
5: Beratung    (war: BeratungTab, Tab 5)
6: Historie    (war: StandDerArbeitTab, Tab 2)
```

Deaktivierte Tabs (nicht im Nav, Komponenten bleiben im Code für spätere Migration):
- Dashboard / UebersichtTab (Tab 0) → Inhalt kommt in Mandant-Tab als Kopfbereich (P2)
- Abschluss / AbschlussTab (Tab 3) → in JA-Auftrag integrieren (P2)
- Lohn / LohnTab (Tab 4) → Filter-View in Aufträge (P2)
- ESt / EStTab (Tab 8) → Filter-View in Aufträge (P2)
- USt / UStTab (Tab 9) → Filter-View in Aufträge (P2)
- Formulare / FormularTab (Tab 10) → in Nachrichten integrieren (P2)
- SuSa / SusaTab (Tab 11) → Tool-Button im JA-Auftrag (P2)
- FIBU / FIBUTab (Tab 12) → Filter-View in Aufträge (P2)

Zu erledigen:
- [x] `src/components/detail/DetailView.jsx` – TAB_NAV auf 7 Einträge reduziert, Reihenfolge korrigiert
- [x] `src/components/detail/DetailView.jsx` – Tab-Rendering-Blöcke auf neue Indizes angepasst
- [x] `src/App.jsx` – alle hartcodierten Tab-Indizes aktualisiert:
  - `setDetailInitialTab(6)` → `setDetailInitialTab(2)` (Nachrichten)
  - `setDetailInitialTab(13)` → `setDetailInitialTab(1)` (Aufträge)
  - `setDetailInitialTab(14)` → `setDetailInitialTab(4)` (Honorare)
  - `setDetailInitialTab(0)` bleibt 0 (Mandant)
  - `setDetailInitialTab(2)` → `setDetailInitialTab(6)` (Historie, für Rückfragen-Links)
  - `setDetailInitialTab(1)` → `setDetailInitialTab(0)` (Mandant/Stammdaten-Links)
- [x] `src/components/detail/DetailView.jsx` – onOpenEmail-Callback jetzt Tab 2 statt 6

### 1C – AuftragTab: Auftrag-Logik entfernen, wird zu "Mandant"

AuftragTab heißt im Tab "Mandant". Der Auftrag-Konfigurationsblock (CategoryCards mit Checkliste Formalien, Auftrag-Chip-Setup) wird entfernt. Was bleibt:
- Setup-Chips (Rechtsform, Gewinnermittlung, Steuerarten, USt, Lohn) ← bleiben als Mandant-Konfiguration
- Kontakte-Sektion ← bleibt
- Steuerliche Stammdaten (Steuernummer, GF, Gesellschafter, OneDrive) ← bleibt
- Absender/Signatur-Sektion ← VERSCHOBEN nach Nachrichten (P2)
- API-Key ← bleibt vorerst hier

Zu erledigen:
- [x] CategoryCard-Block und Auftrag-Checkliste-Logik aus AuftragTab entfernt
- [x] Tab-Label von "Stammdaten" → "Mandant" geändert

### 1D – Globale Suche: Tab-Indizes aktualisieren
- [x] `src/utils/search.js` – action.tab Werte für Aufträge (1), Nachrichten (2), Honorare (4), Mandant (0) aktualisiert

---

## PRIORITÄT 2 – Mittlere Umbauten (nach P1 erledigt)

### 2A – Tab "Mandant" neu strukturieren
- [ ] Kopfbereich: Mini-Dashboard mit letztem Auftrag, letzter E-Mail, offenen Rückfragen (aus UebersichtTab übernehmen)
- [ ] Absender + Signaturen-Sektion aus AuftragTab raus, in KommunikationTab verschieben
- [ ] UebersichtTab-Komponente deaktivieren/entfernen

### 2B – Tab "Aufträge" erweitern
- [ ] Filter-Tabs oben: Alle · JA · Lohn · FIBU · USt · ESt · Beratung
- [ ] SuSa-Import als Tool-Button im JA-Auftrag
- [ ] JA-Abschluss-Checkliste (AbschlussTab-Inhalt) in JA-Auftrag einbetten

### 2C – Tab "Nachrichten" aufräumen
- [ ] FormularTab-Funktion als Tab/Button in Nachrichten integrieren
- [ ] Redundante Verlaufs-Anzeige aus KommunikationTab reduzieren (liegt schon in Historie)
- [ ] 2936-Zeilen-Monolith in sinnvolle Unterkomponenten aufteilen

### 2D – Tab "Historie" vereinfachen
- [ ] StandDerArbeitTab auf reine chronologische Ereignisliste reduzieren
- [ ] KI-Aktionen und Formular-Logik raus (die gehören in Nachrichten)
- [ ] Klare Unterscheidung: E-Mails / Notizen / Telefonate / Rückfragen

### 2E – Lohn/FIBU/ESt/USt als Auftrags-Filter
- [ ] In AuftraegeTab einen Filter-Mechanismus einbauen
- [ ] LohnTab / FIBUTab / EStTab / UStTab als Filter-Ansichten auf Aufträge umbauen (nicht mehr als eigene Datenbehälter)
- [ ] Alte Tab-Dateien nach Migration entfernen

---

## PRIORITÄT 3 – Größere Umbauten (nach P1+P2 erledigt)

### 3A – Design-Refresh
- [ ] Mehr Weißraum, weniger Farb-Noise
- [ ] Konsistente Schriftgrößen (aktuell: 9px bis 16px wild gemischt)
- [ ] Tab-Navigation: klarer, moderner
- [ ] Karten: weichere Schatten, größerer Border-Radius
- [ ] Farbpalette auf 2-3 Akzentfarben reduzieren (statt aktuell ~8)

### 3B – Aufgaben-Übersicht modernisieren
- [ ] GlobalTodoView: Bessere Gruppierung nach Status + Frist + Mandant
- [ ] Kompaktere Darstellung pro Auftrag
- [ ] "Heute fällig" deutlicher hervorheben

### 3C – Auftrags-Timeline
- [ ] Jeder Auftrag bekommt eigenen Verlauf (E-Mails + Notizen + Dokumente die am Auftrag hängen)
- [ ] Intelligente Erinnerungen: "Mandant hat seit X Tagen nicht geantwortet"

---

## Technische Schulden (parallel beheben)

- [ ] `fmtDatumLang` / `fmtDateShort` / `fmtDatum` – in ~15 Dateien lokal dupliziert → zentrale utils-Funktion
- [ ] `genId()` – in ~8 Dateien dupliziert → zentral
- [ ] Tab-Indizes nie mehr hardcoden → Konstanten-Objekt `TAB = { mandant: 0, auftraege: 1, ... }`
- [ ] KommunikationTab aufteilen: EmailEditor / EmailList / InlineReply / EmailDetailPanel

---

## Commit-Strategie

Jeder Schritt wird einzeln committed:
- `refactor: Tote Dateien entfernt (P1A)`
- `refactor: Tab-Navigation 15→7, neue Reihenfolge (P1B)`
- `refactor: AuftragTab → Mandant, Auftrag-Logik entfernt (P1C)`
- usw.

---

## Status

**Aktuell:** Priorität 1 in Arbeit
**Zuletzt:** REFACTOR.md erstellt
**Nächste Sitzung beginnt mit:** Weitermachen bei P1A (tote Dateien)
