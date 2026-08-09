# Session-Brief: Checklisten & Jahresabschluss

Dieser Chat behandelt **ausschließlich** den Bereich Jahresabschluss-Checklisten des JA-Dashboards („Jans Spielbuch"). Andere Bereiche (Easy-B2B, USt-Registrierung, Dashboard-Kern) laufen in eigenen Chats.

## Sprache & Stil
- Antworten auf **Deutsch, Du-Form**. Kurz, praxisnah, auf den Punkt (Bulletpoints/Tabellen). Bei fachlicher Unsicherheit sagen, nicht raten.
- Konten (SKR03/04) und Steuerparagraphen sind **Vorschläge**, die der Nutzer (Steuerberater) selbst prüft.

## Was zu diesem Bereich gehört (hier darfst du arbeiten)
- `src/utils/jaCheckliste/` — die gesamte Fachlogik:
  - `registry.js` — framework-freie Modul-Registry (`MODULE`), Helfer (num/eur/tage/setStichtag), Rechner, Vorlagen (`vorlageJA`), Bereiche (`VIEW_ORDER/VIEW_LABEL/BEREICH/BEREICH_FARBE`), Klassifizierung (`klassifiziereKonto`, `erloesKategorie`, `ustRolleGuess`), Import-Übernahme (`applyKonten`, `fillExisting`), Rückfragen (`sammleRueckfragen`, `aufbereitenText`), Export (`buildExportSheets`), Assistent (`assistAnalyse`, `applyAssist`)
  - `styles.js` — gescopter Style-Block (`.jac2`, helle Prototyp-Palette, theme-unabhängig)
  - `susaReader.js` — SuSa/CSV/XLSX-Leser (nutzt `xlsx`, **lazy** importiert)
  - `exportExcel.js` — echtes `.xlsx` via SheetJS (lazy)
- `src/components/ChecklistenBereich.jsx` — Top-Level-Menüpunkt „Checklisten" (Übersicht, neue Checkliste, Öffnen)
- `src/components/detail/JAChecklisteV2.jsx` — die Checklisten-Fachanwendung (rendert die Registry datengetrieben)
- JA-Teile von `src/components/detail/AuftraegeTab.jsx` (Unterreiter Checkliste im Mandanten-Auftrag)

## NICHT anfassen (gehört anderen Sessions)
- `src/App.jsx`, `src/components/HauptNavigation.jsx` → **Dashboard-Kern-Chat**. Nur wenn ein *neuer* Top-Level-Menüpunkt registriert werden muss: kleiner, sofort gepushter Einzel-Commit, nicht parallel zu anderen Sessions.
- `src/easyb2b/*`, `UstRegistrierungBereich*`, E-Mail/Termine/Cloud-Storage-Kern.

## Datenmodell (additiv, nie Mandantendaten verlieren)
- Eigenständige Checklisten-Sammlung: Cloud-Key `spielbuch-checklisten-uebersicht-v1` (in App.jsx verdrahtet; State `checklisten`).
- Eine Checkliste: `{ id, titel, mandantId, gewinnermittlung('euer'|'bilanz'), status, jaChecklisteV2, erstelltAm, geaendertAm }`.
- Fachdaten: `au.jaChecklisteV2 = { v:2, gw, kategorien:[{ id, name, bereich, abschnitt, punkte:[] }], buchungen:[] }`.
- Prüfpunkt: `{ id, titel, typ('A'|'B'|'C'), modul, konten:[], status, werte:{…} }`. `werte` hält Felder, Flags, Konten-Listen (`konten`, benannte `listen`), `_pos`, `rueckfragen`, `darlehen` etc.
- Persistenz läuft über `onUpdate(patch)` → Supabase (debounced). **Nur additiv**; Migration aus altem `{v:1,punkte}` in `buildData`.

## Modul-Architektur (so fügst du ein Modul hinzu)
Neuer Eintrag in `MODULE` in `registry.js`:
- `{ name, bereich, typ }` — `bereich` ∈ `be|ba|aktiva|passiva|steuern`. Typ A=einfach, B=Kontenprüfung, C=Fachmodul.
- Optional: `flags:[{k,label}]`, `felder:[{k,l,t,def,opt,full}]` (t: text|num|date|select|area; `felder` darf auch Funktion `(ctx,w)=>[…]` sein), `positionen:true`+`posFelder`, oder benannte `listen:[{key,label,rowNotes,rowFertig,felder}]`.
- `kontoListe:true` → erscheint als Ziel im SuSa-Import (Konten landen in der `konten`-Liste) und in der Abstimmung.
- `rechnen:(w,ctx)=>({ergebnisse:[{l,v,stark}],total:{l,v},hinweise:[…],buchungen:[{s,st,h,ht,betr,text}]})` — Ergebnis/Buchungsanzeige.
- `custom:'darlehen'` → eigene Render-Weiche.
Bereiche werden über `VIEW_ORDER/VIEW_LABEL/BEREICH/BEREICH_FARBE` + `ensureKat` gepflegt; neue Bereiche brauchen zusätzlich eine `.viewtab.on.<key>`-Regel in `styles.js`.

## Vorhandene Module (Stand)
BE: 6 Erlös-Kategorien, Betriebsaufgabe (§16), Firmenfahrzeug/1-%-Methode (mehrere Kfz, E/Hybrid/Verbrenner, Kostendeckelung), diverse Stubs.
BA: Bewirtung, RAP, Warenbestand?, kontoModul-Kategorien, u. a.
Aktiva: Anlagevermögen, Warenbestand, Forderungen (WB), Kontenkategorien, Aktive RAP.
Passiva: Rückstellungen, Verbindlichkeiten, Kapital, § 6b-Rücklage, Passive RAP (PRAP), Kontenkategorien.
Steuern: Umsatzsteuer (Konten & Verprobung), Gewerbesteuer (Abstimmung & Berechnung).
Querschnitt: SuSa-Import + Auto-Zuordnung, Abstimmungs-Cockpit, Rückfragen-Sammler, Excel-Export, Vorbereitungs-Assistent.

## Referenz
Der ursprüngliche Prototyp ist die Vorlage/Referenz für Detailverhalten: `C:\Users\flott\Cloude\Prototypen\Jahresabschluss-Checklisten.html`. Details siehe Memory `projekt_ja_checklisten`.

## Verifizieren (WICHTIG: Login ins Live-Dashboard ist nicht möglich)
- Immer `npm run build` (muss grün sein).
- UI/Logik im Browser über eine **Render-Harness** prüfen (echtes React, ohne Login): Modul dynamisch importieren und mit Testdaten in ein Wegwerf-DOM rendern; Rechner direkt über `import('/src/utils/jaCheckliste/registry.js')` testen. (Der Dev-Server läuft am besten via `npm run dev` **aus dem vollen Pfad** – die gespeicherte Startkonfiguration „jahresabschluss" nutzt einen 8.3-Kurzpfad und schlägt mit „Failed to load url" fehl.)
- Den Nutzer im eigenen Dev-Server testen lassen; Ergebnisse ehrlich berichten.

## Git / Push-Disziplin
- Branch `master` = Preview. **Nur pushen, wenn der Nutzer ausdrücklich „push" sagt.** Sonst committen/pushen NICHT.
- Feature-Dateien gezielt stagen. **Nicht** pushen: `_est_preview_entry.jsx`, `_nav_preview_entry.jsx`, `src/components/detail/EStSections.jsx` (Scratch/WIP).
- Commit-Messages enden mit:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
