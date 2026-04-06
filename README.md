# Jan's Spielbuch – Jahresabschluss-Dashboard

## Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 18 installieren (LTS-Version empfohlen)

## Starten

```bash
cd jan-spielbuch
npm install
npm run dev
```

Danach im Browser öffnen: **http://localhost:5173**

## Build für Produktion

```bash
npm run build
npm run preview
```

## Daten

Alle Daten werden im `localStorage` des Browsers gespeichert und bleiben beim Reload erhalten.
Beim allerersten Start werden 5 Beispiel-Mandate geladen.
