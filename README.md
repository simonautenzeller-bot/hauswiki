# Hauswiki+

Installierbare Mobile-PWA für das Wissen rund ums Haus: Notizen, Aufgaben übers
Jahr, Geräte mit Anleitung/Garantie, Zählerstände und Kontakte (Handwerker,
Firmen). Kein Server, keine Build-Pipeline – reines HTML/CSS/JS, Aufbau wie
Hausplaner+.

## Was die App kann

- **Eine Suche für alles:** „Heizung“, „Holz“, „Bodenleger“ – durchsucht Titel,
  Texte, Stichwörter, Bereiche (inkl. Suchbegriffen wie *holz → Kamin & Holz*),
  Gerätedaten, Dateinamen und Kontakte. „Frühling“, „Herbst“, „April“ oder
  „jetzt“ zeigen die passenden Aufgaben.
- **Jetzt dran:** Die Startseite zeigt die Aufgaben des aktuellen Monats zum
  Abhaken. Eine Aufgabe über mehrere Monate (z. B. Okt–Nov) gilt einmal pro
  Saison als erledigt.
- **Bereiche** (Garten, Heizung, Kamin & Holz, …) frei anlegbar, mit Symbol,
  Farbe und Suchbegriffen.
- **Eintragstypen:** Notiz, Aufgabe (Monate), Gerät (Hersteller, Modell,
  Seriennummer, Kauf, Garantie – läuft sie in 90 Tagen ab, erscheint ein
  Hinweis auf der Startseite), Zähler (Ablesungen mit Foto, Verbrauch und
  Ø pro Tag).
- **Fotos & PDFs** an jedem Eintrag; Fotos werden auf max. 1600 px verkleinert.
- **Kontakte** mit Gewerk, Telefon (direkt anrufen), E-Mail, Adresse, Notizen
  und Verknüpfung zu Einträgen und Bereichen.
- **Jahr:** alle Aufgaben der nächsten 12 Monate.

Beim ersten Start legt die App einen Grundstock typischer Aufgaben und die
Zähler Gas/Strom/Wasser an – alles änder- und löschbar.

## Datenspeicherung

Alles liegt **ausschließlich lokal** auf dem Gerät: Texte in `localStorage`
(`hauswiki:v1`), Fotos/PDFs als Blobs in IndexedDB (`hauswiki-files`). Die App
bittet den Browser per `navigator.storage.persist()`, die Daten nicht bei
Speicherknappheit zu löschen.

Ein Backup ist **eine JSON-Datei mit allen Daten und Dateien** (Base64).
Herunterladen/Einspielen unter **Mehr → Daten**.

## Wochen-Backup

`js/backup.js` ist die gemeinsame Kopie aus den anderen Apps (Doku im README von
alltagplus), mit einer kleinen, rückwärtskompatiblen Erweiterung:
`opts.getSnapshot()` darf das Backup asynchron liefern – hier inkl. Fotos und PDFs
aus IndexedDB. Ohne `getSnapshot` verhält sie sich wie bisher.
Weiterleitungs-URI für die Microsoft-App-Registrierung:
`https://simonautenzeller-bot.github.io/hauswiki/`.

## Veröffentlichung

GitHub Pages aus dem Branch `main`, Ordner `/ (root)`:
`https://simonautenzeller-bot.github.io/hauswiki/`. `start_url` und `scope` im
Manifest sind relativ und funktionieren mit dem Unterpfad.

## Lokal testen

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

Danach `http://localhost:8131` öffnen. Achtung: Der Service Worker liefert
zuerst aus dem Cache – nach Code-Änderungen zweimal neu laden oder
`CACHE_NAME` in `service-worker.js` hochzählen.

## Struktur

```
index.html            Markup, Ansichten, Bottom-Nav, Dialoge
css/styles.css        Design-Tokens/Themes aus Hausplaner+ plus Hauswiki-Teil am Ende
js/store.js           Datenschicht: localStorage + IndexedDB, Aufgabenstatus, Backup
js/search.js          Suche inkl. Jahreszeiten/Monate
js/ui.js              Rendering der Ansichten
js/main.js            Hash-Routing, Formulare, Datei-Upload, Event-Wiring
js/backup.js          Wochen-Backup (gemeinsame Kopie)
service-worker.js     Offline-Caching des App-Shells
```

## App-Version

`APP_VERSION` in `js/store.js`, angezeigt unter **Mehr → Über die App**.
