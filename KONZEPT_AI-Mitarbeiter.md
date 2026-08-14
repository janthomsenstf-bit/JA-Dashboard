# Konzept: Der AI-Mitarbeiter im Spielbuch

**Status:** Entwurf zum Umsetzen · **Rolle dieses Dokuments:** Bauplan für die *bauende* Sitzung.
**Grundsatz:** Erkennen → Verstehen → Bewerten → **Handlung empfehlen** → CTA anbieten → **nach Freigabe** ausführen → dokumentieren → nächsten Schritt überwachen.

> Dieses Dokument ist **additiv und unversioniert** (kein Commit durch die Denk-Sitzung). Es beschreibt *zwei* zentrale Bausteine plus den Anschluss an das vorhandene Datenmodell und eine Bau-Reihenfolge.

---

## 0. Warum überhaupt (die Leitidee)

Normale Software erzeugt Arbeit: *„Hier stimmt etwas nicht."* → der Mensch muss überlegen, was zu tun ist.
Der AI-Mitarbeiter dreht das um: *„Hier stimmt etwas nicht. Ich habe es analysiert. Das wären die nächsten 4 Schritte. Welche soll ich ausführen?"*

Damit das **konsistent** funktioniert (und nicht jede Stelle eigene Buttons erfindet), braucht es genau **zwei** wiederverwendbare Bausteine:

1. **Der Aktionskatalog** — eine feste Liste erlaubter Aktionen. Die AI *wählt* daraus, sie erfindet nichts.
2. **Das Empfehlungs-Objekt („Vorgang")** — ein einheitliches Schema, das jede Stelle (Mail, Beleg, JA-Prüfung, Bescheid, Telefonnotiz) gleich befüllt und das immer gleich dargestellt wird.

Alles andere (wo die Empfehlung erscheint — Nachrichten-Reiter, eigene Zentrale, Handy per MCP) ist nur eine **Oberfläche** über denselben zwei Bausteinen.

---

## 1. Baustein A — Der Aktionskatalog

Eine Aktion ist ein Objekt mit fester Form. Die AI liefert nur `id` + `parameter`; die App weiß, *wie* ausgeführt wird.

```ts
Aktion = {
  id: string,              // z.B. "aufgabe_anlegen" — Schlüssel in den Katalog
  parameter: object,       // vorbefüllt von der AI (z.B. {mandantId, titel, faelligkeit})
}
```

### Sicherheitsstufen (nicht verhandelbar)
| Stufe | Bedeutung | Beispiele |
|---|---|---|
| 🟢 **auto** | reines Lesen/Anzeigen, keine Änderung | anzeigen, suchen, recherchieren |
| 🟡 **bestätigen** | verändert Daten, aber **additiv & umkehrbar** → 1 Klick Freigabe | Aufgabe/Frist/Notiz/Prüfpunkt anlegen, Beleg ablegen |
| 🔴 **freigeben** | **außenwirksam oder unwiderruflich** → immer eigener, expliziter Klick, **nie** in „Alle ausführen" automatisch | Mail **senden**, Löschen |

**Regel für „Alle ausführen":** führt 🟢 + 🟡 nach *einer* Bestätigung aus. 🔴-Aktionen werden nur **vorbereitet** (z.B. Entwurf), der Versand bleibt ein separater Klick des Nutzers.

### Der Katalog (Anschluss an das vorhandene Spielbuch)
> „Datenanschluss" = der bereits existierende Setter/Store, über den **sicher** geschrieben wird (App-eigene Speicherung, kein Roh-Schreiben in die DB).

| ID | Aktion | Kat. | Parameter | Datenanschluss (vorhanden) | Stufe |
|---|---|---|---|---|---|
| `aufgabe_anlegen` | Aufgabe erstellen | ✅ Aufgaben | mandantId?, titel, faelligkeit?, beschreibung? | `addAufgabe({typ:'einmal',…})` → `aufgabenListe` | 🟡 |
| `aufgabe_zuweisen` | Aufgabe an Kollegen | ✅ Aufgaben | +bearbeiter | wie oben **+ Feld `bearbeiter`** (neu; braucht Mitarbeiter-Liste) | 🟡 |
| `frist_anlegen` | Frist eintragen | ⏰ Fristen | mandantId?, titel, datum | Sonderfall von `aufgabe_anlegen` mit Fristdatum | 🟡 |
| `wiedervorlage_anlegen` | Wiedervorlage/Erinnerung | 🔔 WV | bezug, datum | Wiedervorlage-Feld existiert (BotInbox/AuftraegeTab) | 🟡 |
| `anruf_aufgabe` | Anruf-Aufgabe | 📞 Komm. | mandantId, worum, faelligkeit? | `aufgabe_anlegen` mit Typ „Anruf" | 🟡 |
| `rueckfrage_anlegen` | Rückfrage erfassen | 🗂️ Vorgang | mandantId, text | `addRueckfrage(clientId, text)` → `client.rueckfragen` | 🟡 |
| `notiz_anlegen` | Notiz/Gesprächsnotiz | 📝 Vorgang | mandantId, text | `client.notizen` / `kommunikation.events` | 🟡 |
| `mail_entwurf` | Mail vorbereiten | 📧 Komm. | mandantId, betreff, text, anhaenge? | vorhandener KI-Entwurf + Compose (KommunikationTab) | 🟡 |
| `mail_senden` | Mail senden | 📤 Komm. | entwurfId | `api/send-email` | 🔴 |
| `termin_anlegen` | Termin anlegen | 📅 Kalender | mandantId?, start, titel | `addTermin(t)` → `termine` (extern später) | 🟡 |
| `beleg_ablegen` | Belege ablegen | 📎 Dok. | dateien[], zielAuftrag/zielordner | OneDrive `createFolder`/`moveItem` (Posteingang-Logik) | 🟡 |
| `dok_an_auftrag` | Dokument→Auftrag | 🗂️ Dok. | dokId, auftragId | `auftragId`-Kopplung (im Aufbau) | 🟡 |
| `beleg_suchen` | fehlenden Beleg suchen | 🔎 Dok. | mandantId, was | OneDrive `searchDrive` (nur anzeigen) | 🟢 |
| `pruefpunkt_anlegen` | Prüfpunkt (JA) | 📊 JA | mandantId, jahr, text | `client.checklisten` / `standDerArbeit.offenePunkte` | 🟡 |
| `pruefpunkt_erledigen` | Prüfpunkt erledigen | ✓ JA | mandantId, punktId | `client.checklisten[typ][item].erledigt` | 🟡 |
| `auftrag_blockieren` | JA bis Klärung blockieren | 🚧 JA | mandantId, auftragId, grund | Status-Feld am Auftrag | 🟡 |
| `stammdaten_aktualisieren` | Stammdaten ändern | 👤 Mandant | mandantId, patch | `updateClient(id, patch)` | 🟡 |
| `recherche` | Sachverhalt recherchieren | 🔍 Recherche | frage | (neu; Internet — noch nicht vorhanden) | 🟢 |
| `weitere_pruefung` | AI-Prüfung vertiefen | 🤖 AI | kontext | interner KI-Aufruf | 🟢 |

**Wichtig:** Jede Aktion trägt ihre Stufe im Katalog — daran lassen sich später **Berechtigungen** hängen (welcher Nutzer darf welche Stufe/Kategorie auslösen).

---

## 2. Baustein B — Das Empfehlungs-Objekt („Vorgang")

Jeder relevante Anlass erzeugt genau **dieses** Objekt. Egal ob er aus einer Mail, einem Beleg, einer JA-Prüfung oder einer Telefonnotiz kommt.

```ts
Vorgang = {
  id: string,
  schwere: 'info' | 'hinweis' | 'handlungsbedarf',   // Farbe: grau / gelb / rot
  mandantId: string | null,
  titel: string,                 // "Handlungsbedarf – Müller GmbH"
  quelle: { typ: 'mail'|'dokument'|'ja-pruefung'|'bescheid'|'notiz'|'ueberwachung', ref: string },
  feststellung: string,          // was ist objektiv der Fall (nur Fakten)
  einschaetzung: string,         // AI-Bewertung, klar als Einschätzung markiert
  empfehlung: string,            // was die AI empfiehlt
  aktionen: Aktion[],            // vorbefüllte Katalog-Aktionen (die CTAs)
  erledigt?: boolean,
}
```

### Darstellungsvertrag (immer gleich)
```
[Farbe je schwere]  {titel}
Feststellung:   {feststellung}
AI-Einschätzung:{einschaetzung}
Empfehlung:     {empfehlung}
Aktionen:  [Aktion 1] [Aktion 2] [Aktion 3]   [✨ Alle empfohlenen ausführen]
```
- Buttons kommen **ausschließlich** aus `aktionen` (= Katalog). Kein Handerfinden.
- „Alle ausführen" = Batch über `aktionen` unter Beachtung der Stufen (🔴 bleibt Entwurf/Freigabe).
- Nach Ausführung: `erledigt=true`, kurze Quittung („✓ 3 Aktionen ausgeführt, 1 Entwurf wartet auf Versand").

---

## 3. Ein Vorgang durchgerechnet (dein Szenario 1)

Eingehende Mail „Müller GmbH – JA 2025", Mandant hat Rückfrage vom 08.08. teilweise beantwortet.

```json
{
  "schwere": "hinweis",
  "mandantId": "<Müller GmbH>",
  "titel": "Rückfrage-Antwort – Müller GmbH (JA 2025)",
  "quelle": { "typ": "mail", "ref": "<messageId>" },
  "feststellung": "Kassenbestand beantwortet, Darlehensvertrag + Strombelege beigefügt. Frage zur offenen Forderung nicht beantwortet.",
  "einschaetzung": "Die Unterlagen gehören zum JA-Auftrag 2025. Ein Punkt bleibt offen.",
  "empfehlung": "Belege am JA 2025 ablegen, offenen Punkt aktualisieren, Rückfrage zur Forderung erneut stellen, in 7 Tagen wiedervorlegen.",
  "aktionen": [
    { "id": "beleg_ablegen",       "parameter": { "dateien": ["Darlehensvertrag","Strombelege"], "zielAuftrag": "JA-2025" } },
    { "id": "pruefpunkt_erledigen","parameter": { "punktId": "kassenbestand" } },
    { "id": "mail_entwurf",        "parameter": { "betreff": "Rückfrage offene Forderung", "text": "…" } },
    { "id": "wiedervorlage_anlegen","parameter": { "bezug": "JA-2025 Forderung", "datum": "+7d" } }
  ]
}
```
„Alle ausführen": legt Belege ab (🟡), hakt Kassenbestand ab (🟡), erstellt die Wiedervorlage (🟡) — und **bereitet** die Mail vor (🔴 → wartet auf deinen Sende-Klick).

---

## 4. Wo die Empfehlung erscheint (Oberfläche ist austauschbar)

Derselbe `Vorgang` kann gerendert werden in:
- dem **Nachrichten-Reiter** (heutige „Schnellaktionen"),
- einer eigenen **„AI-Empfehlungen"-Liste** (Posteingang der Vorgänge),
- über den **MCP** auf **Cowork/Handy** (dieselben Aktionen als MCP-Tools).

→ **Einmal Katalog + Vorgang bauen, beliebig oft anzeigen.** Der MCP reicht später *genau diese* Aktionen nach draußen — kein zweites System.

---

## 5. Empfohlene Bau-Reihenfolge (klein, sicher, spürbar)

- **Etappe 0 — Fundament (nur Datenstruktur, kein UI):** `aktionskatalog.js` (die Tabelle oben als Objekt) + `Vorgang`-Typ + ein zentraler `fuehreAktionAus(aktion)`-Dispatcher, der auf die **vorhandenen App-Setter** mappt. Datensicherheit: nur additive Setter, nie Roh-DB.
- **Etappe 1 — 3 sichere Aktionen an *einer* Stelle:** `aufgabe_anlegen`, `wiedervorlage_anlegen`, `rueckfrage_anlegen` — plus die `Vorgang`-Karte mit „Alle ausführen". Erst im Posteingang/Nachrichten-Reiter. (Löst sofort deinen MISO-/Müller-Wunsch.)
- **Etappe 2 — Dokumente & JA:** `beleg_ablegen`, `dok_an_auftrag`, `pruefpunkt_anlegen/erledigen`, `auftrag_blockieren`.
- **Etappe 3 — Korrespondenz & Kalender:** `mail_entwurf` (🟡) + `mail_senden` (🔴, Freigabe), `termin_anlegen` mit Verfügbarkeitsprüfung.
- **Etappe 4 — MCP:** gehosteter Spielbuch-MCP, der den Katalog als Tools nach Cowork/Handy reicht (Secret-Auth, Schreibwege über denselben Dispatcher/Server → kein Überschreiben).
- **Etappe 5 (später) — Lernen:** wiederkehrende Aktionsmuster erkennen → „Wie üblich ausführen?".

---

## 6. Bewusst (noch) NICHT im Katalog / später

- 🔎 **Internet-Recherche** — noch keine Anbindung im Spielbuch.
- 📅 **Externer Kalender** (Outlook/Google-Verfügbarkeit) — heute nur interne Termine.
- ☎️ **Gesprächsnotiz per Diktat** (Szenario 10) — braucht Handy-Eingang (Cowork/MCP) + `notiz_anlegen`.
- 👥 **Aufgabe an Kollegen / Arbeitsverteiler** — braucht ein **Mitarbeiter-/Rollenmodell** (wer ist für Lohn zuständig?).
- 🧠 **Muster lernen** — sinnvoll erst, wenn genug echte Vorgänge durchlaufen sind.

---

## 7. Zwei Leitplanken für die bauende Sitzung

1. **Sicheres Schreiben:** Jede 🟡/🔴-Aktion läuft über einen **App-eigenen Setter** (oder später eine merge-sichere API) — **nie** roh in Supabase, damit ein offener Client nichts überschreibt. (Vgl. Datenverlust-Regel.)
2. **Katalog = einzige Quelle:** UI-Buttons werden **aus dem Katalog erzeugt**, nicht per Hand. Neue Fähigkeit = neue Katalog-Zeile, nicht neuer Sonder-Button.
