# Design: Große Paketverwaltung im VS-Code-Editor

## Status

Freigegeben am 21. Juli 2026. Gewählt wurde die Variante „Pfad-Explorer + Details“.

## Ziel

Die Paketverwaltung soll nicht mehr in einem kleinen Modal der AngularPad-Seitenleiste stattfinden. Beim Bearbeiten eines Pakets oder einer Paketgruppe öffnet AngularPad stattdessen rechts einen großen, wiederverwendeten VS-Code-Editor-Tab. Dort sollen alle gefundenen `package.json`-Dateien übersichtlich nach Pfad navigierbar sein. Auswahl, vollständige Pfade, Abhängigkeitstypen, aktuelle Versionen und die Änderungsvorschau bleiben gleichzeitig sichtbar. Zusätzlich kann eine externe `package.json` schreibgeschützt geladen und mit allen lokalen Paketvorkommen verglichen werden. Abweichende externe Versionsnummern lassen sich bei Bedarf gezielt auf bereits vorhandene lokale Pakete übertragen.

## Bestehendes Verhalten

- Der Filter steht neben dem Scan-Button und sucht nach Dependency-Namen.
- „Version ändern“ und die Scope-Aktion öffnen ein auf 320 Pixel begrenztes Modal.
- Alle Vorkommen sind beim Öffnen ausgewählt.
- Die Vorschau wird erst nach einem zusätzlichen Klick aufgebaut; erst der folgende Klick speichert.
- Die vorhandene Backend-Logik in `src/packages.ts` scannt `package.json`-Dateien und wendet Änderungen unter Erhalt von Einrückung, Schlüsselreihenfolge und abschließendem Zeilenumbruch an.

## Gewählte Lösung

### Seitenleiste

- Der Button „Pakete scannen“ bleibt oben.
- Direkt darunter steht ein Eingabefeld über die gesamte verfügbare Breite.
- Der Filter ist case-insensitiv und berücksichtigt ausschließlich den relativen Ordnerpfad sowie den vollständigen Pfad der jeweiligen `package.json`-Datei. Er filtert keine Dependency-Namen.
- Eine passende `package.json` wird vollständig mit allen enthaltenen Dependencies angezeigt.
- Die bisherigen Aktionen „Version ändern“ und „Alle Scope-Pakete ändern“ bleiben an den Paketzeilen erhalten, öffnen aber kein Modal mehr.

### Editor-Tab

- AngularPad erstellt ein `WebviewPanel` mit dem Titel „AngularPad · Pakete“ in `ViewColumn.Beside`.
- Es existiert höchstens ein Paket-Panel pro VS-Code-Fenster. Ist es bereits geöffnet, wird es aufgedeckt und mit dem neu angeklickten Paket beziehungsweise Scope fokussiert.
- Der Editor besitzt ebenfalls einen Scan-Button und eine Pfadsuche.
- Links zeigt ein Explorer die gefundenen `package.json`-Pfade mit Paketanzahl. Der gewählte Pfad lässt seine Pakete erkennen und auswählen.
- Rechts zeigt die Detailansicht das gewählte Paket oder den gewählten Scope und alle zugehörigen Vorkommen im Workspace.
- Jede Vorkommenszeile enthält Checkbox, Paketname, vollständigen `package.json`-Pfad, Dependency-Typ und aktuelle Version.
- Beim Öffnen sind alle Vorkommen ausgewählt. Oberhalb der Liste stehen Auswahlzähler und „Alles abwählen“.
- Direkt unter der Liste ist die Vorschau immer sichtbar.
- Änderungen am Versionsfeld und an jeder Checkbox aktualisieren Auswahlzähler und Vorschau unmittelbar.
- Die Vorschau enthält nur ausgewählte Vorkommen, deren aktuelle Version von der neuen Version abweicht.
- Der primäre Button speichert direkt. Er zeigt die Anzahl wirksamer Änderungen und ist deaktiviert, wenn die neue Version leer ist, nichts ausgewählt ist oder keine Version abweicht.
- Das bisherige Paket-Modal und sein zweistufiger Vorschau-/Bestätigungszustand entfallen vollständig.

### Externer Vergleich

- Der große Editor besitzt die Aktion „Vergleichsdatei hinzufügen“ sowie eine Drag-and-drop-Zone für genau eine JSON-Datei.
- Die Dateiauswahl verwendet den nativen VS-Code-Dateidialog und darf eine `package.json` außerhalb des aktuellen Workspaces öffnen.
- Die externe Datei bleibt immer schreibgeschützt und wird weder verändert noch dauerhaft gespeichert. Sie gilt nur für den geöffneten Paket-Tab.
- Nach dem Laden erscheint im selben Editor-Tab ein eigener Modus „Externer Vergleich“. Die Projektübersicht bleibt als benachbarter Modus erhalten.
- Verglichen werden alle beim Workspace-Scan gefundenen lokalen Vorkommen aus `dependencies`, `devDependencies`, `peerDependencies` und `optionalDependencies` mit denselben Bereichen der externen Datei.
- Der Vergleich gruppiert nach Paketname und zeigt die Zustände „Gleich“, „Abweichend“, „Nur lokal“ und „Nur extern“. Rein externe Pakete bleiben optisch sichtbar, können aber nicht zum Workspace hinzugefügt werden.
- Bei abweichenden Paketen können einzelne lokale Vorkommen anhand von vollständigem Pfad, Dependency-Typ und aktueller Version ausgewählt werden. Aus Sicherheitsgründen ist beim Vergleich zunächst nichts ausgewählt.
- Die Live-Vorschau zeigt für jede Auswahl die lokale Version und die zu übernehmende externe Version. Gespeichert wird über dieselbe `applyVersionChanges`-Logik wie bei der manuellen Bearbeitung.
- Nach einer Übernahme wird der Workspace neu gescannt und der Vergleich mit der weiterhin geladenen Referenzdatei automatisch neu berechnet.
- Enthält die externe Datei denselben Paketnamen mit widersprüchlichen Versionen in mehreren Dependency-Bereichen, wird der Eintrag als mehrdeutig dargestellt und eine Übernahme deaktiviert.
- Eine ungültige oder nicht lesbare JSON-Datei erzeugt einen konkreten Fehlerzustand, ohne den zuletzt erfolgreichen Vergleich zu ersetzen.

## Architektur

### Extension Host

- `src/packages.ts` bleibt die einzige Quelle für Scan- und Schreiblogik.
- Eine neue, fokussierte `PackageManagerPanel`-Klasse verwaltet Erzeugung, Wiederverwendung, Nachrichten, den nativen Dateidialog und den Lebenszyklus des Editor-Tabs.
- `NgCommanderViewProvider` delegiert neue `openPackageManager`-Nachrichten aus der Seitenleiste an dieses Panel. Der Fokusauftrag enthält Paket oder Scope, die angeklickte Datei und die Ausgangsversion.
- Nach erfolgreichen oder teilweise erfolgreichen Änderungen lädt das Panel seine Daten neu. Der bestehende Seitenleisten-Webview erhält ebenfalls aktualisierte Dependency-Daten.
- Erfolg und einzelne Fehler werden weiterhin über VS-Code-Benachrichtigungen gemeldet. Fehlgeschlagene Änderungen werden nicht als erfolgreich dargestellt.

### Webviews

- Die vorhandene Seitenleiste behält ihre allgemeinen Assets; modalbezogenes Markup, Styling und JavaScript werden entfernt.
- Der große Paket-Editor erhält eigene HTML-, CSS- und JavaScript-Assets, damit seine komplexere Oberfläche nicht weiter in `src/webview/main.js` anwächst.
- Reine Zustandsfunktionen für Pfadfilter, Fokussierung, Auswahl und Vorschau werden von DOM-Manipulation und VS-Code-Nachrichten getrennt. Dadurch lassen sie sich ohne Browser testen.
- Beide Oberflächen verwenden VS-Code-Farb- und Schriftvariablen. Pfade und Versionen erscheinen in der Editor-Schrift; Fokuszustände und beschriftete Bedienelemente bleiben per Tastatur erkennbar.

## Datenfluss

1. Die Seitenleiste scannt Dependencies oder verwendet die zuletzt geladenen Daten.
2. Ein Klick auf eine Bearbeitungsaktion sendet Zieltyp, Paket/Scope, Ausgangsdatei und Ausgangsversion an den Extension Host.
3. Der Extension Host erstellt oder fokussiert das Paket-Panel rechts und lädt die aktuellen Workspace-Dependencies.
4. Das Panel sendet Daten und Fokusauftrag an seinen Webview.
5. Der Webview filtert links ausschließlich nach Pfaden und leitet rechts die passenden Vorkommen für Paket oder Scope ab.
6. Versionseingabe und Checkboxen erzeugen synchron ein neues Vorschau-Modell.
7. Beim Speichern sendet der Webview nur die aktuell ausgewählten, tatsächlich abweichenden Änderungen.
8. `applyVersionChanges` schreibt die Dateien. Anschließend werden Panel und Seitenleiste aus einem neuen Scan aktualisiert.
9. Für einen externen Vergleich liest der Extension Host die über den Dateidialog gewählte Datei als Text; bei Drag-and-drop liest der Webview den Dateiinhalt über die Browser-Datei-API.
10. Der reine Vergleichscode parst die vier Dependency-Bereiche, bildet die Vereinigung aus externen Paketnamen und lokalen Workspace-Vorkommen und leitet Status sowie übertragbare Änderungen ab.
11. Externe Versionsübernahmen durchlaufen denselben Speicher- und Aktualisierungsfluss wie manuelle Änderungen; die Referenzdatei erhält niemals Schreibzugriff.

## Fehler- und Leerzustände

- Ohne Workspace oder gefundene Dependencies zeigt der Editor einen erklärenden Leerzustand mit Scan-Aktion.
- Ein Pfadfilter ohne Treffer zeigt „Keine passenden package.json-Pfade“.
- Ohne Auswahl zeigt die Vorschau „Keine Dateien ausgewählt“.
- Bei leerer neuer Version markiert die Oberfläche das Feld und deaktiviert Speichern.
- Bei identischen Versionen zeigt die Vorschau „Keine Änderungen“ und deaktiviert Speichern.
- Teilweise fehlgeschlagene Dateiänderungen werden über die vorhandenen `AppliedChange`-Ergebnisse gemeldet; erfolgreiche Änderungen bleiben erhalten und beide Ansichten werden anschließend neu geladen.
- Ohne Vergleichsdatei zeigt der Vergleichsmodus eine Dateiauswahl- und Drag-and-drop-Aufforderung.
- Pakete, die nur extern vorkommen, werden mit externer Version und dem Status „Nur extern“ angezeigt; ihre Auswahl ist deaktiviert.
- Pakete, die nur lokal vorkommen, werden mit ihren lokalen Vorkommen und dem Status „Nur lokal“ angezeigt.
- Ungültige JSON-Struktur, fehlende Dependency-Bereiche oder widersprüchliche externe Versionen werden verständlich dargestellt und niemals automatisch geschrieben.

## Tests und Verifikation

- Die Umsetzung erfolgt testgetrieben mit Nodes eingebautem Test-Runner und ohne neue Laufzeitabhängigkeit.
- Regressionstests decken mindestens ab:
  - case-insensitiven Filter nach relativem und vollständigem `package.json`-Pfad;
  - Ausschluss der Dependency-Namen aus der Pfadsuche;
  - Fokus eines Pakets und eines Scopes;
  - standardmäßig vollständige Auswahl und „Alles abwählen“;
  - Live-Vorschau nur für ausgewählte, tatsächlich abweichende Vorkommen;
  - deaktiviertes Speichern bei leerer Version, leerer Auswahl oder ohne wirksame Änderung.
  - Parsing der vier unterstützten Dependency-Bereiche einer externen Datei;
  - Vergleichszustände „Gleich“, „Abweichend“, „Nur lokal“, „Nur extern“ und „Mehrdeutig“;
  - standardmäßig leere Auswahl für externe Übernahmen;
  - Vorschau externer Versionen nur für bereits vorhandene, ausgewählte lokale Vorkommen;
  - unveränderte externe Quelle nach jeder Übernahme.
- Abschlussprüfungen: fokussierte Tests, vollständiger Testlauf, `npm run compile` und `git diff --check`.

## Nicht Bestandteil

- Keine Änderung der eigentlichen SemVer-Syntax oder automatische Versionsermittlung.
- Keine Paketinstallation ohne den bereits vorhandenen ausdrücklichen Nutzerklick.
- Keine direkte Bearbeitung anderer Felder einer `package.json`.
- Kein Hinzufügen von Paketen, die ausschließlich in der externen Datei vorkommen.
- Keine dauerhafte Speicherung oder Änderung der externen Vergleichsdatei.
- Keine neuen npm-Abhängigkeiten und keine Backend-Änderungen.
