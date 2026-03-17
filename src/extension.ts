import * as vscode from "vscode";

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
    id: "npm-install",
    label: "npm install",
    command: "npm install",
    group: "Package Manager",
    color: "#22c55e",
    icon: "📦",
  },
  {
    id: "npm-update",
    label: "npm update",
    command: "npm update",
    group: "Package Manager",
    color: "#22c55e",
    icon: "⬆️",
  },
  {
    id: "npm-audit",
    label: "npm audit",
    command: "npm audit",
    group: "Package Manager",
    color: "#22c55e",
    icon: "🛡️",
  },
];

export function activate(context: vscode.ExtensionContext) {
  const provider = new NgCommanderViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("angularpad.panel", provider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("angularpad.openPanel", () => {
      vscode.commands.executeCommand("angularpad.panel.focus");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("angularpad.runCommand", (cmd: string) => {
      runInTerminal(cmd);
    }),
  );
}

// These commands block the terminal — they get their own dedicated terminal
const DEDICATED_COMMANDS = ["ng serve", "ng test", "ng e2e"];

function getTerminalName(command: string): string {
  const match = DEDICATED_COMMANDS.find((c) => command.startsWith(c));
  return match ? `AngularPad: ${match}` : "AngularPad";
}

function runInTerminal(command: string) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const cwd = workspaceFolders?.[0]?.uri.fsPath;

  const terminalName = getTerminalName(command);
  let terminal = vscode.window.terminals.find((t) => t.name === terminalName);

  if (!terminal) {
    terminal = vscode.window.createTerminal({ name: terminalName, cwd });
  }

  terminal.show();
  terminal.sendText(command);
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
          runInTerminal(msg.command);
          break;
        case "runWithInput":
          vscode.window
            .showInputBox({ prompt: msg.prompt, placeHolder: msg.placeholder })
            .then((value) => {
              if (value !== undefined) {
                runInTerminal(msg.command + value);
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
      }
    });
  }

  private _getHtml(): string {
    const defaultCmds = JSON.stringify(DEFAULT_COMMANDS);
    return `<!DOCTYPE html>
<html lang="de">
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
  h3:first-of-type { margin-top: 4px; }

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

  /* Custom command section */
  .add-form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px;
    margin-top: 8px;
  }

  .add-form input, .add-form select {
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
  .add-form input:focus, .add-form select:focus {
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

  select option { background: var(--input-bg); }
</style>
</head>
<body>

<h3>Angular</h3>
<div class="cmd-grid" id="angular-grid"></div>

<h3>Lint &amp; Format</h3>
<div class="cmd-grid" id="lint-grid"></div>

<h3>Package Manager</h3>
<div class="cmd-grid" id="npm-grid"></div>

<h3>Custom Commands</h3>
<div id="custom-list"></div>

<button class="toggle-btn" onclick="toggleForm()">
  <span id="toggle-icon">＋</span> <span id="toggle-text">Befehl hinzufügen</span>
</button>

<div class="add-form section" id="add-form">
  <div class="form-row">
    <input id="f-label" placeholder="Label (z.B. Build Staging)" />
    <select id="f-color">
      <option value="custom">Blau (Custom)</option>
      <option value="red">Rot (Angular)</option>
      <option value="amber">Gelb (Lint)</option>
      <option value="green">Grün (NPM)</option>
      <option value="purple">Lila</option>
    </select>
  </div>
  <input id="f-command" placeholder="Befehl (z.B. ng build --configuration staging)" />
  <input id="f-icon" placeholder="Icon Emoji (optional, z.B. 🎯)" />
  <button class="btn-primary" onclick="addCustom()">Hinzufügen</button>
</div>

<script>
const vscode = acquireVsCodeApi();
const DEFAULT_COMMANDS = ${defaultCmds};

let customCommands = [];

// Group and render default commands
const groups = { 'Angular': 'angular-grid', 'Lint & Format': 'lint-grid', 'Package Manager': 'npm-grid' };
const colorMap = { '#dd0031': 'red', '#f59e0b': 'amber', '#22c55e': 'green' };

DEFAULT_COMMANDS.forEach(cmd => {
  const gridId = groups[cmd.group];
  if (!gridId) return;
  const grid = document.getElementById(gridId);
  const btn = document.createElement('button');
  btn.className = 'cmd-btn ' + (colorMap[cmd.color] || 'custom');
  btn.title = cmd.command;
  btn.innerHTML = '<span class="cmd-icon">' + cmd.icon + '</span><span class="cmd-label">' + cmd.label + '</span>';
  btn.onclick = () => {
    if (cmd.command.endsWith(' ')) {
      vscode.postMessage({ type: 'runWithInput', command: cmd.command, prompt: cmd.label, placeholder: 'Name eingeben...' });
    } else {
      vscode.postMessage({ type: 'run', command: cmd.command });
    }
  };
  grid.appendChild(btn);
});

// Load custom commands
vscode.postMessage({ type: 'getCustomCommands' });

window.addEventListener('message', e => {
  if (e.data.type === 'customCommands') {
    customCommands = e.data.commands || [];
    renderCustom();
  }
});

function renderCustom() {
  const list = document.getElementById('custom-list');
  list.innerHTML = '';
  if (customCommands.length === 0) {
    list.innerHTML = '<div id="no-custom">Noch keine eigenen Befehle</div>';
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

let formOpen = false;
function toggleForm() {
  formOpen = !formOpen;
  document.getElementById('add-form').classList.toggle('open', formOpen);
  document.getElementById('toggle-icon').textContent = formOpen ? '−' : '＋';
  document.getElementById('toggle-text').textContent = formOpen ? 'Abbrechen' : 'Befehl hinzufügen';
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

  // Reset form
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

export function deactivate() {}
