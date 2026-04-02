import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";

interface Command {
  id: string;
  label: string;
  command: string;
  group: string;
  color: string;
  icon: string;
}

const DEFAULT_COMMANDS: Command[] = [
  // Angular
  {
    id: "ng-serve",
    label: "Serve",
    command: "ng serve",
    group: "Angular",
    color: "#dd0031",
    icon: "▶",
  },
  {
    id: "ng-build",
    label: "Build",
    command: "ng build",
    group: "Angular",
    color: "#dd0031",
    icon: "🔨",
  },
  {
    id: "ng-build-prod",
    label: "Build Prod",
    command: "ng build --configuration production",
    group: "Angular",
    color: "#dd0031",
    icon: "🚀",
  },
  {
    id: "ng-test",
    label: "Test",
    command: "ng test",
    group: "Angular",
    color: "#dd0031",
    icon: "🧪",
  },
  {
    id: "ng-e2e",
    label: "E2E",
    command: "ng e2e",
    group: "Angular",
    color: "#dd0031",
    icon: "🔍",
  },
  {
    id: "ng-generate-component",
    label: "Generate Component",
    command: "ng generate component ",
    group: "Angular",
    color: "#dd0031",
    icon: "✨",
  },
  {
    id: "ng-generate-service",
    label: "Generate Service",
    command: "ng generate service ",
    group: "Angular",
    color: "#dd0031",
    icon: "⚙️",
  },
  // Linting
  {
    id: "ng-lint",
    label: "Lint",
    command: "ng lint",
    group: "Lint & Format",
    color: "#f59e0b",
    icon: "🔎",
  },
  {
    id: "nx-lint-all",
    label: "Lint All (Nx)",
    command: "ng run-many --target=lint --all",
    group: "Lint & Format",
    color: "#f59e0b",
    icon: "🧹",
  },
  {
    id: "ng-lint-fix",
    label: "Lint --fix",
    command: "ng lint --fix",
    group: "Lint & Format",
    color: "#f59e0b",
    icon: "🔧",
  },
  {
    id: "prettier",
    label: "Prettier",
    command: "npx prettier --write .",
    group: "Lint & Format",
    color: "#f59e0b",
    icon: "✨",
  },
  // NPM
  {
    id: "pm-install",
    label: "npm install",
    command: "npm install",
    group: "Package Manager",
    color: "#22c55e",
    icon: "📦",
  },
  {
    id: "pm-update",
    label: "npm update",
    command: "npm update",
    group: "Package Manager",
    color: "#22c55e",
    icon: "⬆️",
  },
  {
    id: "pm-audit",
    label: "npm audit",
    command: "npm audit",
    group: "Package Manager",
    color: "#22c55e",
    icon: "🛡️",
  },
];

async function getProjectRoot(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const files = await vscode.workspace.findFiles(
    "**/package.json",
    "**/node_modules/**",
  );

  if (files.length === 0) {
    return rootPath;
  }

  files.sort((a, b) => a.fsPath.length - b.fsPath.length);
  return path.dirname(files[0].fsPath);
}

async function getNxProjects(): Promise<string[]> {
  const projects = new Set<string>();

  const projectJsons = await vscode.workspace.findFiles(
    "**/project.json",
    "**/node_modules/**",
  );
  for (const file of projectJsons) {
    try {
      const content = fs.readFileSync(file.fsPath, "utf8");
      const json = JSON.parse(content);
      if (json.name) projects.add(json.name);
    } catch (e) {}
  }

  const workspaceJsons = await vscode.workspace.findFiles(
    "{angular.json,workspace.json}",
    "**/node_modules/**",
  );
  for (const file of workspaceJsons) {
    try {
      const content = fs.readFileSync(file.fsPath, "utf8");
      const json = JSON.parse(content);
      if (json.projects) {
        Object.keys(json.projects).forEach((p) => projects.add(p));
      }
    } catch (e) {}
  }

  return Array.from(projects).sort();
}

async function getPackageJsonScripts(
  pm: string,
): Promise<{ label: string; command: string; color: string; icon: string }[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const files = await vscode.workspace.findFiles(
    "**/package.json",
    "**/node_modules/**",
  );
  const allScripts: {
    label: string;
    command: string;
    color: string;
    icon: string;
  }[] = [];

  for (const file of files) {
    try {
      const fileContent = fs.readFileSync(file.fsPath, "utf8");
      const packageJson = JSON.parse(fileContent);
      const scripts = packageJson.scripts || {};

      if (Object.keys(scripts).length === 0) continue;

      const relPath = path.relative(rootPath, path.dirname(file.fsPath));
      const folderLabel = relPath === "" ? "root" : relPath;
      const absPath = path.dirname(file.fsPath);

      for (const scriptName of Object.keys(scripts)) {
        let finalCommand = `${pm} run ${scriptName}`;

        if (relPath !== "") {
          if (pm === "yarn") {
            finalCommand = `yarn --cwd "${absPath}" run ${scriptName}`;
          } else if (pm === "pnpm") {
            finalCommand = `pnpm --dir "${absPath}" run ${scriptName}`;
          } else {
            finalCommand = `npm run ${scriptName} --prefix "${absPath}"`;
          }
        }

        allScripts.push({
          label: `[${folderLabel}] ${scriptName}`,
          command: finalCommand,
          color: "#3b82f6",
          icon: "📦",
        });
      }
    } catch (error) {
      console.error(`Fehler beim Lesen von ${file.fsPath}`, error);
    }
  }

  return allScripts.sort((a, b) => a.label.localeCompare(b.label));
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new NgCommanderViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("angularpad.panel", provider),
    vscode.commands.registerCommand("angularpad.openPanel", () => {
      vscode.commands.executeCommand("angularpad.panel.focus");
    }),
    vscode.commands.registerCommand("angularpad.runCommand", (cmd: string) => {
      handleCommand(cmd, context);
    }),
  );
}

function getTerminalName(command: string): string {
  if (command.includes("serve")) return "AngularPad: Serve";
  if (command.includes("test")) return "AngularPad: Test";
  if (command.includes("e2e")) return "AngularPad: E2E";
  if (command.includes("lint") || command.includes("run-many"))
    return "AngularPad: Lint";
  return "AngularPad";
}

async function runInTerminal(command: string) {
  const cwd = await getProjectRoot();

  const terminalName = getTerminalName(command);
  let terminal = vscode.window.terminals.find((t) => t.name === terminalName);

  if (!terminal) {
    terminal = vscode.window.createTerminal({ name: terminalName, cwd });
  } else if (cwd) {
    terminal.sendText(`cd "${cwd}"`);
  }

  terminal.show();
  terminal.sendText(command);
}

async function handleCommand(
  command: string,
  context: vscode.ExtensionContext,
) {
  const cli = context.globalState.get<string>("cli");
  let finalCommand = command;

  if (cli === "nx") {
    const isNxTarget = /\bnx\s+(serve|build|test|lint|e2e)(?:\s+-|$)/.test(
      command,
    );
    const isNxGenerate =
      /\bnx\s+(g|generate)\b/.test(command) && !command.includes("--project");

    if (isNxTarget || isNxGenerate) {
      const projects = await getNxProjects();

      if (projects.length > 0) {
        const lang = context.globalState.get<string>("language") || "en";
        const placeHolder =
          lang === "de"
            ? "Wähle das Projekt (App/Lib) aus..."
            : "Select the project (App/Lib)...";

        const selected = await vscode.window.showQuickPick(projects, {
          placeHolder,
        });

        if (!selected) {
          return;
        }

        if (isNxTarget) {
          const targetMatch = finalCommand.match(
            /\bnx\s+(serve|build|test|lint|e2e)/,
          );
          if (targetMatch) {
            finalCommand = finalCommand.replace(
              targetMatch[0],
              `${targetMatch[0]} ${selected}`,
            );
          }
        } else if (isNxGenerate) {
          finalCommand += ` --project="${selected}"`;
        }
      }
    }
  }

  runInTerminal(finalCommand);
}

class NgCommanderViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "run":
          handleCommand(msg.command, this._context);
          break;
        case "runWithInput":
          vscode.window
            .showInputBox({ prompt: msg.prompt, placeHolder: msg.placeholder })
            .then((value) => {
              if (value !== undefined) {
                handleCommand(msg.command + value, this._context);
              }
            });
          break;
        case "saveCustomCommands":
          this._context.globalState.update("customCommands", msg.commands);
          break;
        case "getCustomCommands": {
          const cmds = this._context.globalState.get<Command[]>(
            "customCommands",
            [],
          );
          webviewView.webview.postMessage({
            type: "customCommands",
            commands: cmds,
          });
          break;
        }
        case "saveSettings": {
          this._context.globalState.update(
            "packageManager",
            msg.packageManager,
          );
          this._context.globalState.update("language", msg.language);
          this._context.globalState.update("cli", msg.cli);
          break;
        }
        case "getSettings": {
          vscode.workspace
            .findFiles("**/nx.json", "**/node_modules/**", 1)
            .then((nxFiles) => {
              const hasNx = nxFiles.length > 0;
              const pm =
                this._context.globalState.get<string>("packageManager");
              const lang = this._context.globalState.get<string>("language");
              const cli = this._context.globalState.get<string>("cli");

              webviewView.webview.postMessage({
                type: "initSettings",
                packageManager: pm,
                language: lang,
                cli: cli,
                hasNx: hasNx,
              });
            });
          break;
        }
        case "getProjectScripts": {
          const pm =
            this._context.globalState.get<string>("packageManager") || "npm";
          getPackageJsonScripts(pm).then((scripts) => {
            webviewView.webview.postMessage({
              type: "projectScripts",
              scripts: scripts,
            });
          });
          break;
        }
      }
    });
  }

  private _getHtml(): string {
    const defaultCmds = JSON.stringify(DEFAULT_COMMANDS);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NG Commander</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: var(--vscode-sideBar-background, #1a1a2e);
    --surface: var(--vscode-editor-background, #16213e);
    --border: var(--vscode-panel-border, #0f3460);
    --text: var(--vscode-foreground, #e0e0e0);
    --muted: var(--vscode-descriptionForeground, #888);
    --input-bg: var(--vscode-input-background, #0d1b2a);
    --btn-hover: var(--vscode-button-hoverBackground, #1a4a6e);
    --accent: #4fc3f7;
    --red: #dd0031;
    --amber: #f59e0b;
    --green: #22c55e;
    --purple: #a78bfa;
  }

  body {
    font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
    font-size: 12px;
    color: var(--text);
    background: var(--bg);
    padding: 8px;
    overflow-x: hidden;
  }

  .header-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
  }
  .tabs {
    display: flex;
    gap: 4px;
    flex: 1;
  }
  .tab-btn {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    font-weight: bold;
    font-family: inherit;
    transition: background 0.2s, color 0.2s;
  }
  .tab-btn:hover { background: var(--surface); }
  .tab-btn.active { color: var(--accent); background: var(--surface); }
  
  .icon-btn {
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    border-radius: 4px;
    transition: background 0.2s, color 0.2s;
  }
  .icon-btn:hover { background: var(--surface); color: var(--accent); }
  
  .tab-content { display: none; }
  .tab-content.active { display: block; }

  .modal-overlay {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6);
    z-index: 1000;
    align-items: center;
    justify-content: center;
  }
  .modal-overlay.open { display: flex; }
  .modal-content {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 16px;
    width: 90%;
    max-width: 260px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  }
  .modal-content h3 { border-bottom: none; margin: 0 0 8px 0; color: var(--text); font-size: 13px; }

  h3 {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
    margin: 12px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
  }

  .cmd-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    margin-bottom: 4px;
  }

  .cmd-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    transition: all 0.15s ease;
    text-align: left;
    position: relative;
    overflow: hidden;
  }

  .cmd-btn::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    border-radius: 5px 0 0 5px;
  }

  .cmd-btn.red::before { background: var(--red); }
  .cmd-btn.amber::before { background: var(--amber); }
  .cmd-btn.green::before { background: var(--green); }
  .cmd-btn.purple::before { background: var(--purple); }
  .cmd-btn.custom::before { background: var(--accent); }

  .cmd-btn:hover {
    background: var(--btn-hover);
    border-color: var(--accent);
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(0,0,0,0.3);
  }

  .cmd-btn:active { transform: translateY(0); }

  .cmd-icon { font-size: 13px; flex-shrink: 0; }
  .cmd-label { flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .add-form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px;
    margin-top: 8px;
  }

  .add-form input, .add-form select, .modal-content select {
    width: 100%;
    margin-bottom: 6px;
    padding: 5px 8px;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 11px;
    font-family: inherit;
    outline: none;
  }
  .add-form input:focus, .add-form select:focus, .modal-content select:focus {
    border-color: var(--accent);
  }

  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

  .btn-primary {
    width: 100%;
    padding: 6px;
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 700;
    font-size: 11px;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .btn-primary:hover { opacity: 0.85; }

  .custom-item {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 5px;
  }

  .custom-item .cmd-btn { flex: 1; }

  .del-btn {
    padding: 5px 7px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: #ef4444;
    cursor: pointer;
    font-size: 12px;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .del-btn:hover { background: rgba(239,68,68,0.15); }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    padding: 5px 0;
    background: transparent;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    margin-top: 6px;
  }
  .toggle-btn:hover { opacity: 0.8; }

  .section { display: none; }
  .section.open { display: block; }

  #no-custom {
    color: var(--muted);
    font-size: 11px;
    text-align: center;
    padding: 8px 0;
  }
</style>
</head>
<body>

<div class="header-bar">
  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('main')" data-i18n="tabMain">Standard</button>
    <button class="tab-btn" onclick="switchTab('project')" data-i18n="tabProject">Workspace</button>
  </div>
  <button class="icon-btn" onclick="openSettings()" title="Settings">⚙️</button>
</div>

<div id="settings-modal" class="modal-overlay">
  <div class="modal-content">
    <h3 data-i18n="settingsTitle">⚙️ Settings</h3>
    <p style="color: var(--muted); margin-bottom: 12px;" data-i18n="settingsDesc">Please choose your preferences:</p>
    
    <label style="display:block; margin-bottom:4px; color:var(--muted)" data-i18n="langLabel">Language / Sprache:</label>
    <select id="modal-lang-select">
      <option value="en">English</option>
      <option value="de">Deutsch</option>
    </select>

    <label style="display:block; margin-top:8px; margin-bottom:4px; color:var(--muted)" data-i18n="cliLabel">Workspace CLI:</label>
    <select id="modal-cli-select">
      <option value="ng">Angular CLI (ng)</option>
      <option value="nx">Nx Workspace (nx)</option>
    </select>

    <label style="display:block; margin-top:8px; margin-bottom:4px; color:var(--muted)" data-i18n="pmLabel">Package Manager:</label>
    <select id="modal-pm-select">
      <option value="npm">NPM</option>
      <option value="yarn">Yarn</option>
      <option value="pnpm">PNPM</option>
    </select>
    
    <button class="btn-primary" style="margin-top: 12px;" onclick="saveSettings()" data-i18n="btnSave">Save</button>
  </div>
</div>

<div id="tab-main" class="tab-content active">
  <h3 data-i18n="hdrAngular">Angular</h3>
  <div class="cmd-grid" id="angular-grid"></div>

  <h3 data-i18n="hdrLint">Lint & Format</h3>
  <div class="cmd-grid" id="lint-grid"></div>

  <h3 data-i18n="hdrPm">Package Manager</h3>
  <div class="cmd-grid" id="npm-grid"></div>

  <h3 data-i18n="hdrCustom">Custom Commands</h3>
  <div id="custom-list"></div>

  <button class="toggle-btn" onclick="toggleForm()">
    <span id="toggle-icon">＋</span> <span id="toggle-text" data-i18n="btnAddCustom">Add Command</span>
  </button>

  <div class="add-form section" id="add-form">
    <div class="form-row">
      <input id="f-label" data-i18n-placeholder="formLabel" placeholder="Label (e.g. Build Staging)" />
      <select id="f-color">
        <option value="custom" data-i18n="colorCustom">Blue (Custom)</option>
        <option value="red" data-i18n="colorRed">Red (Angular)</option>
        <option value="amber" data-i18n="colorAmber">Yellow (Lint)</option>
        <option value="green" data-i18n="colorGreen">Green (NPM)</option>
        <option value="purple" data-i18n="colorPurple">Purple</option>
      </select>
    </div>
    <input id="f-command" data-i18n-placeholder="formCmd" placeholder="Command (e.g. ng build --configuration staging)" />
    <input id="f-icon" data-i18n-placeholder="formIcon" placeholder="Icon Emoji (optional, e.g. 🎯)" />
    <button class="btn-primary" onclick="addCustom()" data-i18n="formBtnSubmit">Add</button>
  </div>
</div>

<div id="tab-project" class="tab-content">
  <p style="color: var(--muted); margin-bottom: 10px;" data-i18n="projectDesc">Scan all package.json files in your workspace.</p>
  <button class="btn-primary" style="margin-bottom: 12px; display: flex; justify-content: center; align-items: center; gap: 6px;" onclick="scanProject()">
    <span style="font-size: 14px;">🔍</span> <span data-i18n="btnScan">Scan Scripts</span>
  </button>
  <div class="cmd-grid" id="project-grid"></div>
</div>

<script>
const vscode = acquireVsCodeApi();
const DEFAULT_COMMANDS = ${defaultCmds};

let customCommands = [];
let currentLang = 'en';
let formOpen = false;

const i18n = {
  en: {
    tabMain: "Standard",
    tabProject: "Workspace",
    settingsTitle: "⚙️ Settings",
    settingsDesc: "Please choose your preferences:",
    langLabel: "Language / Sprache:",
    cliLabel: "Workspace CLI:",
    pmLabel: "Package Manager:",
    btnSave: "Save",
    hdrAngular: "Angular",
    hdrLint: "Lint & Format",
    hdrPm: "Package Manager",
    hdrCustom: "Custom Commands",
    btnAddCustom: "Add Command",
    btnCancel: "Cancel",
    formLabel: "Label (e.g. Build Staging)",
    formCmd: "Command (e.g. ng build --configuration staging)",
    formIcon: "Icon Emoji (optional, e.g. 🎯)",
    formBtnSubmit: "Add",
    projectDesc: "Scan all package.json files in your workspace.",
    btnScan: "Scan Scripts",
    noCustom: "No custom commands yet",
    noScripts: "No package.json found or no scripts available.",
    scanning: "Scanning...",
    colorCustom: "Blue (Custom)",
    colorRed: "Red (Angular)",
    colorAmber: "Yellow (Lint)",
    colorGreen: "Green (NPM)",
    colorPurple: "Purple"
  },
  de: {
    tabMain: "Standard",
    tabProject: "Workspace",
    settingsTitle: "⚙️ Einstellungen",
    settingsDesc: "Bitte wähle deine Einstellungen:",
    langLabel: "Language / Sprache:",
    cliLabel: "Workspace CLI:",
    pmLabel: "Package Manager:",
    btnSave: "Speichern",
    hdrAngular: "Angular",
    hdrLint: "Lint & Format",
    hdrPm: "Package Manager",
    hdrCustom: "Eigene Befehle",
    btnAddCustom: "Befehl hinzufügen",
    btnCancel: "Abbrechen",
    formLabel: "Label (z.B. Build Staging)",
    formCmd: "Befehl (z.B. ng build --configuration staging)",
    formIcon: "Icon Emoji (optional, z.B. 🎯)",
    formBtnSubmit: "Hinzufügen",
    projectDesc: "Scanne alle package.json in deinem Workspace.",
    btnScan: "Skripte scannen",
    noCustom: "Noch keine eigenen Befehle",
    noScripts: "Keine package.json gefunden oder keine Skripte vorhanden.",
    scanning: "Scanne...",
    colorCustom: "Blau (Custom)",
    colorRed: "Rot (Angular)",
    colorAmber: "Gelb (Lint)",
    colorGreen: "Grün (NPM)",
    colorPurple: "Lila"
  }
};

function applyTranslations(lang) {
  currentLang = lang;
  const dict = i18n[lang] || i18n['en'];
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if(dict[key]) el.innerText = dict[key];
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if(dict[key]) el.placeholder = dict[key];
  });

  document.getElementById('toggle-text').innerText = formOpen ? dict.btnCancel : dict.btnAddCustom;
  renderCustom();
}

vscode.postMessage({ type: 'getCustomCommands' });
vscode.postMessage({ type: 'getSettings' });

window.addEventListener('message', e => {
  if (e.data.type === 'initSettings') {
    const pm = e.data.packageManager || 'npm';
    const lang = e.data.language || 'en';
    let cli = e.data.cli;
    
    if (!cli) {
      cli = e.data.hasNx ? 'nx' : 'ng';
    }

    document.getElementById('modal-pm-select').value = pm;
    document.getElementById('modal-lang-select').value = lang;
    document.getElementById('modal-cli-select').value = cli;
    
    applyTranslations(lang);
    renderDefaultCommands(pm, cli);

    if (!e.data.packageManager) {
      openSettings();
    }
  }

  if (e.data.type === 'customCommands') {
    customCommands = e.data.commands || [];
    renderCustom();
  }
  
  if (e.data.type === 'projectScripts') {
    const scripts = e.data.scripts || [];
    const grid = document.getElementById('project-grid');
    grid.innerHTML = '';
    
    if (scripts.length === 0) {
      grid.innerHTML = '<div style="color: #ef4444; grid-column: span 2; padding: 4px;">' + i18n[currentLang].noScripts + '</div>';
    } else {
      scripts.forEach(cmd => {
        const btn = document.createElement('button');
        btn.className = 'cmd-btn custom';
        btn.style.setProperty('--accent', cmd.color);
        btn.title = cmd.command;
        btn.innerHTML = '<span class="cmd-icon">' + cmd.icon + '</span><span class="cmd-label">' + cmd.label + '</span>';
        btn.onclick = () => {
          vscode.postMessage({ type: 'run', command: cmd.command });
        };
        grid.appendChild(btn);
      });
    }
  }
});

function openSettings() {
  document.getElementById('settings-modal').classList.add('open');
}

function saveSettings() {
  const pm = document.getElementById('modal-pm-select').value;
  const lang = document.getElementById('modal-lang-select').value;
  const cli = document.getElementById('modal-cli-select').value;
  
  vscode.postMessage({ type: 'saveSettings', packageManager: pm, language: lang, cli: cli });
  document.getElementById('settings-modal').classList.remove('open');
  
  applyTranslations(lang);
  renderDefaultCommands(pm, cli);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById('tab-' + tabId).classList.add('active');
  event.currentTarget.classList.add('active');
}

function scanProject() {
  document.getElementById('project-grid').innerHTML = '<div style="color: var(--muted); grid-column: span 2; text-align: center; padding: 10px;">' + i18n[currentLang].scanning + '</div>';
  vscode.postMessage({ type: 'getProjectScripts' });
}

function renderDefaultCommands(pm, cli) {
  const groups = { 'Angular': 'angular-grid', 'Lint & Format': 'lint-grid', 'Package Manager': 'npm-grid' };
  const colorMap = { '#dd0031': 'red', '#f59e0b': 'amber', '#22c55e': 'green' };

  Object.values(groups).forEach(id => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = '';
  });

  DEFAULT_COMMANDS.forEach(cmd => {
    // Nx-spezifische Befehle ausblenden, wenn Angular CLI aktiv ist
    if (cmd.id === 'nx-lint-all' && cli !== 'nx') return;

    const gridId = groups[cmd.group];
    if (!gridId) return;

    let finalCommand = cmd.command;
    let finalLabel = cmd.label;

    if (cli === 'nx' && finalCommand.startsWith('ng ')) {
      let nxPrefix = 'npx nx ';
      if (pm === 'yarn') nxPrefix = 'yarn nx ';
      if (pm === 'pnpm') nxPrefix = 'pnpm nx ';
      
      finalCommand = finalCommand.replace(/^ng /, nxPrefix);
    }

    if (cmd.group === 'Package Manager') {
      if (pm === 'yarn') {
        if (cmd.id === 'pm-install') { finalCommand = 'yarn install'; finalLabel = 'yarn install'; }
        if (cmd.id === 'pm-update') { finalCommand = 'yarn upgrade'; finalLabel = 'yarn upgrade'; }
        if (cmd.id === 'pm-audit') { finalCommand = 'yarn audit'; finalLabel = 'yarn audit'; }
      } else if (pm === 'pnpm') {
        if (cmd.id === 'pm-install') { finalCommand = 'pnpm install'; finalLabel = 'pnpm install'; }
        if (cmd.id === 'pm-update') { finalCommand = 'pnpm update'; finalLabel = 'pnpm update'; }
        if (cmd.id === 'pm-audit') { finalCommand = 'pnpm audit'; finalLabel = 'pnpm audit'; }
      }
    }

    const grid = document.getElementById(gridId);
    const btn = document.createElement('button');
    btn.className = 'cmd-btn ' + (colorMap[cmd.color] || 'custom');
    btn.title = finalCommand;
    btn.innerHTML = '<span class="cmd-icon">' + cmd.icon + '</span><span class="cmd-label">' + finalLabel + '</span>';
    btn.onclick = () => {
      if (finalCommand.endsWith(' ')) {
        vscode.postMessage({ type: 'runWithInput', command: finalCommand, prompt: finalLabel, placeholder: 'Name...' });
      } else {
        vscode.postMessage({ type: 'run', command: finalCommand });
      }
    };
    grid.appendChild(btn);
  });
}

function renderCustom() {
  const list = document.getElementById('custom-list');
  list.innerHTML = '';
  if (customCommands.length === 0) {
    list.innerHTML = '<div id="no-custom">' + i18n[currentLang].noCustom + '</div>';
    return;
  }
  customCommands.forEach((cmd, i) => {
    const row = document.createElement('div');
    row.className = 'custom-item';
    row.innerHTML =
      '<button class="cmd-btn ' + (cmd.color || 'custom') + '" title="' + cmd.command + '" onclick="runCustom(' + i + ')">' +
        '<span class="cmd-icon">' + (cmd.icon || '⚡') + '</span>' +
        '<span class="cmd-label">' + cmd.label + '</span>' +
      '</button>' +
      '<button class="del-btn" onclick="deleteCustom(' + i + ')">✕</button>';
    list.appendChild(row);
  });
}

function runCustom(i) {
  vscode.postMessage({ type: 'run', command: customCommands[i].command });
}

function deleteCustom(i) {
  customCommands.splice(i, 1);
  vscode.postMessage({ type: 'saveCustomCommands', commands: customCommands });
  renderCustom();
}

function toggleForm() {
  formOpen = !formOpen;
  document.getElementById('add-form').classList.toggle('open', formOpen);
  document.getElementById('toggle-icon').textContent = formOpen ? '−' : '＋';
  document.getElementById('toggle-text').textContent = formOpen ? i18n[currentLang].btnCancel : i18n[currentLang].btnAddCustom;
}

function addCustom() {
  const label = document.getElementById('f-label').value.trim();
  const command = document.getElementById('f-command').value.trim();
  const color = document.getElementById('f-color').value;
  const icon = document.getElementById('f-icon').value.trim() || '⚡';

  if (!label || !command) {
    document.getElementById('f-label').style.borderColor = label ? '' : '#ef4444';
    document.getElementById('f-command').style.borderColor = command ? '' : '#ef4444';
    return;
  }

  customCommands.push({ id: 'custom-' + Date.now(), label, command, group: 'Custom', color, icon });
  vscode.postMessage({ type: 'saveCustomCommands', commands: customCommands });
  renderCustom();

  document.getElementById('f-label').value = '';
  document.getElementById('f-command').value = '';
  document.getElementById('f-icon').value = '';
  document.getElementById('f-label').style.borderColor = '';
  document.getElementById('f-command').style.borderColor = '';
  toggleForm();
}
</script>
</body>
</html>`;
  }
}

export function deactivate() {
  // Wird aufgerufen, wenn die Extension deaktiviert wird
}
