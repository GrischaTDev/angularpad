# NG Commander

Eine VS Code Extension, um Angular-, Lint- und Build-Befehle per Knopfdruck auszuführen.

## Features

- **Vordefinierte Befehle** für Angular, Linting & Formatting, und NPM
- **Eigene Befehle** hinzufügen und dauerhaft speichern
- Alle Befehle laufen in einem dedizierten **NG Commander Terminal**
- Befehle mit Eingabe (z.B. `ng generate component`) zeigen eine Eingabebox

## Vordefinierte Befehle

### Angular
| Label | Befehl |
|---|---|
| Serve | `ng serve` |
| Build | `ng build` |
| Build Prod | `ng build --configuration production` |
| Test | `ng test` |
| E2E | `ng e2e` |
| Generate Component | `ng generate component <name>` |
| Generate Service | `ng generate service <name>` |

### Lint & Format
| Label | Befehl |
|---|---|
| Lint | `ng lint` |
| Lint --fix | `ng lint --fix` |
| Prettier | `npx prettier --write .` |

### Package Manager
| Label | Befehl |
|---|---|
| npm install | `npm install` |
| npm update | `npm update` |
| npm audit | `npm audit` |

## Eigene Befehle

Über das **„+ Befehl hinzufügen"** Formular können eigene Befehle mit Label, Icon-Emoji und Farbe angelegt werden. Diese werden dauerhaft in VS Code gespeichert.

## Installation (Entwicklung)

```bash
npm install
npm run compile
```

Dann in VS Code: `F5` → Extension Development Host starten.

## Pakete installieren & VSIX bauen

```bash
npm install -g @vscode/vsce
vsce package
```
