# Umsetzungsstand – AI-Mitarbeiter (Fundament BP 0 + BP 1)

**Datum:** 13.08.2026 · **Von:** Denk-Sitzung · **Status:** vorbereitet, **NICHT committed/gepusht**, kollisionsfrei zur Parallel-Sitzung.

Alles hier sind **neue, eigenständige Dateien**. Sie verändern **keine** bestehende Datei
(kein App.jsx, kein KommunikationTab). Damit kann die parallele Bau-Sitzung ungestört
weiterarbeiten; das Einhängen ist ein kurzer, überwachter Schritt (siehe unten).

Interaktive Demo (zum Anschauen): siehe Artifact-Link im Chat.

---

## 1. Was neu gebaut wurde

| Datei | Zweck |
|---|---|
| `src/utils/aktionskatalog.js` | **Der Aktionskatalog** (BP 0): ~19 Aktionen mit id/label/icon/kategorie/**stufe**(auto\|bestaetigen\|freigeben)/umkehrbar/params + `datenanschluss`. Helfer: `aktionDef(id)`, `istBatchfaehig(id)`, `STUFEN`, `KATEGORIEN`. |
| `src/utils/vorgang.js` | **Das „Vorgang"-Objekt** (BP 0): `makeVorgang({…})`, `SCHWERE` (info/hinweis/handlungsbedarf), `beschreibeAktion(aktion)` für die CTA-Anzeige. |
| `src/utils/aktionDispatcher.js` | **Reiner Ausführer** (BP 0): `erstelleDispatcher(adapter)` → `{ fuehreAus, fuehreAlleAus }`. Kennt keinen App-State. 🔴-Aktionen werden nie ausgeführt, nur „vorbereitet". |
| `src/components/agent/VorgangKarte.jsx` | **Die einheitliche Empfehlungskarte** (BP 1): Feststellung → Einschätzung → Empfehlung → Aktions-Chips → „Alle ausführen". Bekommt `vorgang` + `dispatcher` als Props; weiß nichts über App-State. |
| `KONZEPT_AI-Mitarbeiter.md` | Gesamtkonzept (zwei Bausteine, Sicherheitsstufen, Bau-Reihenfolge). |

Alle vier Code-Dateien sind mit esbuild syntaktisch geprüft (OK).

---

## 2. So wird es eingehängt (App.jsx — NICHT angewandt, bereit zum Einbauen)

Der einzige Verdrahtungspunkt ist ein **Adapter**, der Katalog-Aktionen auf die
**vorhandenen** App-Setter abbildet. Damit läuft jedes Schreiben über die App-eigene,
sichere Speicherung (kein Roh-DB-Schreiben).

```jsx
import { erstelleDispatcher } from './utils/aktionDispatcher.js'
import VorgangKarte from './components/agent/VorgangKarte.jsx'

// … in der App-Komponente, wo addAufgabe/addRueckfrage/addTermin/updateClient existieren:
const clientName = (id) => clients.find(c => c.id === id)?.name ?? null
const iso = (ymd) => ymd ? (String(ymd).length <= 10 ? `${ymd}T12:00:00` : ymd) : null

const aiAdapter = {
  aufgabe_anlegen: (p) => addAufgabe({
    typ: 'einmal', titel: p.titel, beschreibung: p.beschreibung ?? '',
    mandantId: p.mandantId ?? null, faellig: iso(p.faelligkeit), erledigt: false,
  }),
  frist_anlegen: (p) => addAufgabe({
    typ: 'einmal', titel: p.titel, mandantId: p.mandantId ?? null,
    faellig: iso(p.faelligkeit), erledigt: false,
  }),
  wiedervorlage_anlegen: (p) => addAufgabe({
    typ: 'einmal', titel: `Wiedervorlage: ${p.bezug}`, mandantId: p.mandantId ?? null,
    faellig: iso(p.faelligkeit), erledigt: false,
  }),
  anruf_aufgabe: (p) => addAufgabe({
    typ: 'einmal', titel: `Anruf: ${p.worum}`, mandantId: p.mandantId ?? null,
    faellig: iso(p.faelligkeit), erledigt: false,
  }),
  rueckfrage_anlegen: (p) => addRueckfrage(p.mandantId, p.text),
  notiz_anlegen: (p) => updateClient(p.mandantId, {
    notizen: [(clients.find(c => c.id === p.mandantId)?.notizen || ''), p.text].filter(Boolean).join('\n'),
  }),
  termin_anlegen: (p) => addTermin({
    id: 't_' + Date.now().toString(36), titel: p.titel, start: p.start, mandantId: p.mandantId ?? null,
  }),
  stammdaten_aktualisieren: (p) => updateClient(p.mandantId, p.patch || {}),
  // mail_entwurf / beleg_ablegen / pruefpunkt_* / auftrag_blockieren: Etappe 2–3
}

const aiDispatcher = erstelleDispatcher(aiAdapter)

// Rendern, sobald ein Vorgang existiert (z.B. aus Posteingang/Mail — siehe BP 4):
// <VorgangKarte vorgang={vorgang} dispatcher={aiDispatcher} mandantName={clientName(vorgang.mandantId)} />
```

**Wichtig:** `beschreibeAktion` zeigt `mandantName`, wenn er im Parameter mitkommt. Beim
Erzeugen eines Vorgangs also `parameter.mandantName` mitfüllen (rein zur Anzeige).

---

## 3. Woher kommen die Vorgänge? (BP 4 – noch offen)

BP 0/1 liefern **Katalog + Karte + Ausführer**. Was noch fehlt, ist die **Erzeugung**
von `Vorgang`-Objekten aus echten Anlässen. Beispiel-Erzeuger (später):
- eingehende Mail analysieren → `makeVorgang({ schwere:'hinweis', … , aktionen:[{id:'beleg_ablegen',parameter:{…}}, …] })`
- Beleg im Posteingang → Vorgang mit `beleg_ablegen` + `pruefpunkt_*`
- JA-Plausibilität (Darlehen/Vorjahr) → Vorgang mit `aufgabe_anlegen` + `auftrag_blockieren`
- Fristen-/Antwort-Überwachung → Vorgang mit `wiedervorlage_anlegen`

Für einen **ersten Test** genügt ein handgebauter `makeVorgang(...)` (z.B. das Müller-Beispiel
aus dem Konzept), gerendert mit `<VorgangKarte>`.

---

## 4. Offene Entscheidungen (für Jan)

1. **Wo lebt die Karte zuerst?** Nachrichten-Reiter (bei den neuen Schnellaktionen), eine eigene „AI-Empfehlungen"-Liste, oder beides.
2. **Reihenfolge:** zuerst In-App-Empfehlungen reif machen — oder den **MCP** (BP 5) vorziehen, damit Handy-Steuerung früher kommt? (MCP hängt nur an BP 0.)
3. **MCP-Infrastruktur** (wenn BP 5): API-Routen im `ja-dashboard`-Vercel-Projekt, ein **Secret-Token** (wie `DOK_SECRET`), Server-Adapter statt App-Setter.
4. **Welche Sitzung baut das ein?** (Entscheidung „nur eine Sitzung baut".)

---

## 5. Sicherheits-Notizen

- **Nichts committed/gepusht.** Neue Dateien sind untracked; keine bestehende Datei verändert.
- Alle 🟡-Aktionen laufen über App-Setter (additiv). 🔴 (Mail senden, Löschen) werden vom Dispatcher **nie** automatisch ausgeführt.
- Vor dem Einhängen: `git fetch` + prüfen, ob die Parallel-Sitzung dieselben Setter/Dateien inzwischen geändert hat.
