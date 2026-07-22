# Package Version Compatibility and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AngularPad distinguish compatible library peer ranges from real root-version conflicts while adding complete package status, navigation, selection, and full-height editing to both package views.

**Architecture:** Extend the shared browser-compatible `PackageManagerModel` with conservative SemVer interval and workspace-status functions, then consume the same model in both webviews. Keep VS Code document opening and reusable-panel lifecycle in the extension host, validating every requested path against a fresh workspace scan.

**Tech Stack:** VS Code Extension API, TypeScript, browser-compatible JavaScript, HTML, CSS, Node.js syntax/contract checks.

## Global Constraints

- Root package ranges are the reference; only nested `peerDependencies` whose range fully contains the root range are compatible.
- Support exact, caret, and tilde numeric SemVer forms without adding a runtime dependency.
- Unsupported version formats fall back conservatively and are compatible only by exact text equality.
- Do not inspect lockfiles, add automatic rescanning, or add path-copy actions.
- Do not add automated test files, following the user's explicit preference.
- Preserve the existing external comparison behavior and read-only boundary.
- Preserve the user's unrelated local modification in `AGENTS.md`.
- Update `AI_CHANGES.md` in the implementation change set.

---

### Task 1: Shared root-aware compatibility model

**Files:**
- Modify: `src/webview/package-manager-model.js:1-205`

**Interfaces:**
- Consumes: existing `PackageFileInfo`-shaped objects and `createOccurrenceKey(item)`.
- Produces: `parseSimpleSemverRange(value)`, `containsSemverRange(container, candidate)`, `buildVersionStatusIndex(files)`, `getOccurrenceVersionStatus(index, item)`, and `getFileVersionSummary(file, index)`.
- Status values: `identical`, `compatible`, and `conflict`.

- [ ] **Step 1: Run an executable precondition check**

```powershell
node -e "const m=require('./src/webview/package-manager-model.js'); if (typeof m.buildVersionStatusIndex !== 'function') process.exit(1)"
```

Expected: exit code 1 because the shared status API does not exist yet.

- [ ] **Step 2: Add conservative SemVer interval parsing**

Add numeric version helpers that accept only `1.2.3`, `^1.2.3`, and
`~1.2.3`, including the SemVer caret rules for major zero:

```js
function compareVersions(left, right) {
  return left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch;
}

function parseSimpleSemverRange(value) {
  const match = String(value).trim().match(/^(\^|~)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  if (!match) return undefined;

  const operator = match[1] || '';
  const min = {
    major: Number(match[2]),
    minor: Number(match[3]),
    patch: Number(match[4]),
  };
  if (!operator) return { min, maxExclusive: undefined, exact: true };

  let maxExclusive;
  if (operator === '~') {
    maxExclusive = { major: min.major, minor: min.minor + 1, patch: 0 };
  } else if (min.major > 0) {
    maxExclusive = { major: min.major + 1, minor: 0, patch: 0 };
  } else if (min.minor > 0) {
    maxExclusive = { major: 0, minor: min.minor + 1, patch: 0 };
  } else {
    maxExclusive = { major: 0, minor: 0, patch: min.patch + 1 };
  }
  return { min, maxExclusive, exact: false };
}

function containsSemverRange(container, candidate) {
  if (!container || !candidate) return false;
  if (container.exact) {
    return candidate.exact && compareVersions(candidate.min, container.min) === 0;
  }
  if (candidate.exact) {
    if (compareVersions(candidate.min, container.min) < 0) return false;
    return compareVersions(candidate.min, container.maxExclusive) < 0;
  }
  return compareVersions(candidate.min, container.min) >= 0 &&
    compareVersions(candidate.maxExclusive, container.maxExclusive) <= 0;
}
```

- [ ] **Step 3: Build package and per-file status summaries**

Create occurrences with `folder` and `absPath`, group by package name, and
select one unambiguous root version. Exact equality is always `identical`.
Only differing nested peers can become `compatible`; missing or ambiguous root
references make every differing occurrence a `conflict`.

```js
function buildVersionStatusIndex(files) {
  const grouped = new Map();
  files.forEach(file => file.deps.forEach(dep => {
    const list = grouped.get(dep.name) || [];
    list.push({ ...dep, folder: file.folder, absPath: file.absPath });
    grouped.set(dep.name, list);
  }));

  const result = new Map();
  grouped.forEach((items, name) => {
    const rootVersions = [...new Set(
      items.filter(item => item.folder === 'root').map(item => item.version),
    )];
    const uniqueVersions = new Set(items.map(item => item.version));
    const referenceVersion = rootVersions.length === 1 ? rootVersions[0] : '';
    const referenceRange = parseSimpleSemverRange(referenceVersion);
    const statuses = new Map();

    items.forEach(item => {
      let status = 'conflict';
      if (referenceVersion && item.version === referenceVersion) {
        status = 'identical';
      } else if (!referenceVersion && uniqueVersions.size === 1) {
        status = 'identical';
      } else if (
        referenceRange &&
        item.folder !== 'root' &&
        item.type === 'peerDependencies' &&
        containsSemverRange(parseSimpleSemverRange(item.version), referenceRange)
      ) {
        status = 'compatible';
      }
      statuses.set(createOccurrenceKey(item), status);
    });

    const values = [...statuses.values()];
    result.set(name, {
      referenceVersion,
      statuses,
      conflictCount: values.filter(value => value === 'conflict').length,
      compatibleCount: values.filter(value => value === 'compatible').length,
      hasConflict: values.includes('conflict'),
    });
  });
  return result;
}

function getOccurrenceVersionStatus(index, item) {
  return index.get(item.name)?.statuses.get(createOccurrenceKey(item)) || 'identical';
}

function getFileVersionSummary(file, index) {
  const statuses = file.deps.map(dep => getOccurrenceVersionStatus(index, {
    ...dep,
    folder: file.folder,
    absPath: file.absPath,
  }));
  return {
    packageCount: file.deps.length,
    conflictCount: statuses.filter(value => value === 'conflict').length,
    compatibleCount: statuses.filter(value => value === 'compatible').length,
  };
}
```

Export all five new functions from the factory return object.

- [ ] **Step 4: Run focused compatibility checks**

```powershell
@'
const m = require('./src/webview/package-manager-model.js');
const files = [
  { folder: 'root', absPath: 'C:/repo/package.json', deps: [{ name: '@angular/core', version: '~21.2.0', type: 'dependencies' }] },
  { folder: 'libs/wide', absPath: 'C:/repo/libs/wide/package.json', deps: [{ name: '@angular/core', version: '^21.2.0', type: 'peerDependencies' }] },
  { folder: 'libs/narrow', absPath: 'C:/repo/libs/narrow/package.json', deps: [{ name: '@angular/core', version: '~21.2.0', type: 'peerDependencies' }] },
];
const index = m.buildVersionStatusIndex(files);
const summary = index.get('@angular/core');
if (summary.hasConflict) throw new Error('compatible ranges were marked as conflicts');
if (summary.compatibleCount !== 1) throw new Error('expected one compatible textual difference');
const reverse = m.containsSemverRange(m.parseSimpleSemverRange('~21.2.0'), m.parseSimpleSemverRange('^21.2.0'));
if (reverse) throw new Error('reverse containment must fail');
if (m.parseSimpleSemverRange('workspace:^21.2.0') !== undefined) throw new Error('unsupported range parsed');
'@ | node
```

Expected: exit code 0 with no output.

- [ ] **Step 5: Commit the shared model**

```powershell
git add src/webview/package-manager-model.js
git commit -m "feat: classify compatible package ranges"
```

### Task 2: Targetless panel entry and validated file opening

**Files:**
- Modify: `package.json:33-44`
- Modify: `src/extension.ts:1-18`
- Modify: `src/provider.ts:12-153`
- Modify: `src/package-manager-panel.ts:20-230`

**Interfaces:**
- Consumes: existing `getWorkspaceDependencies()` and `PackageManagerPanel`.
- Produces: `NgCommanderViewProvider.openPackageManager(target?)`, optional `PackageManagerPanel.show(target?)`, public `PackageManagerPanel.openPackageJson(absPath)`, `openPackageJson` webview message, and command `angularpad.openPackageManager`.

- [ ] **Step 1: Add the contributed command and provider entry point**

Add this command contribution:

```json
{
  "command": "angularpad.openPackageManager",
  "title": "AngularPad: Open Package Manager",
  "icon": "$(package)"
}
```

Expose and register one reusable entry point:

```ts
public async openPackageManager(target?: PackageManagerTarget): Promise<void> {
  await this._packageManagerPanel.show(target);
}
```

```ts
vscode.commands.registerCommand("angularpad.openPackageManager", () =>
  provider.openPackageManager(),
),
```

- [ ] **Step 2: Make panel focus optional**

Change the panel API without creating another panel instance:

```ts
async show(target?: PackageManagerTarget): Promise<void> {
  this.target = target;
  this.focusRevision += 1;
  if (!this.panel) this.createPanel();
  else this.panel.reveal(vscode.ViewColumn.Beside);
  await this.postState();
}
```

Always include `target: this.target` in the state message; `undefined` signals
that the webview should make its automatic first selection.

- [ ] **Step 3: Validate and open scanned package files**

Add an injected document-opening dependency and a public validator:

```ts
openPackageJson: async (filePath) => {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(document, { preview: false });
},
```

```ts
async openPackageJson(value: unknown): Promise<void> {
  if (typeof value !== "string") return;
  const packages = await this.dependencies.scan();
  if (!packages.some(file => file.absPath === value)) {
    await this.dependencies.showWarningMessage(
      "AngularPad: Die package.json gehört nicht zum aktuellen Workspace-Scan.",
    );
    return;
  }
  try {
    await this.dependencies.openPackageJson(value);
  } catch {
    await this.dependencies.showWarningMessage(
      "AngularPad: Die package.json konnte nicht geöffnet werden.",
    );
  }
}
```

Handle `openPackageJson` in the panel and sidebar message switches by calling
this shared validator. Allow `openPackageManager` without a target; validate a
provided target exactly as today before forwarding it.

- [ ] **Step 4: Compile and verify command wiring**

```powershell
npm run compile
rg -n 'angularpad.openPackageManager|openPackageJson|show\(target\?' package.json src/extension.ts src/provider.ts src/package-manager-panel.ts
```

Expected: TypeScript exits 0; the command appears in the manifest and
registration; both webview routes use the validated opening method.

- [ ] **Step 5: Commit extension-host integration**

```powershell
git add package.json src/extension.ts src/provider.ts src/package-manager-panel.ts
git commit -m "feat: add package manager navigation commands"
```

### Task 3: Sidebar package status and direct navigation

**Files:**
- Modify: `src/webview/index.html:120-130`
- Modify: `src/webview/main.js:360-525`
- Modify: `src/webview/styles.css:302-403`
- Modify: `src/webview/i18n.js:40-110,148-218`

**Interfaces:**
- Consumes: `PackageManagerModel.buildVersionStatusIndex`, `getOccurrenceVersionStatus`, `getFileVersionSummary`, targetless `openPackageManager`, and `openPackageJson`.
- Produces: sidebar toggles `pkg-only-conflicts` and `pkg-show-compatible`, per-file status summaries, and direct package-file actions.

- [ ] **Step 1: Add sidebar actions and filters**

Replace the single scan control with explicit actions and view toggles:

```html
<div class="pkg-actions">
  <button class="btn-primary pkg-scan-button" onclick="scanDependencies()">
    <span aria-hidden="true">🔍</span> <span data-i18n="btnScanDeps">Scan Dependencies</span>
  </button>
  <button class="btn-secondary" onclick="openPackageManager()" data-i18n="btnOpenPackageManager">Open package manager</button>
</div>
<div class="pkg-controls">
  <input id="pkg-filter" class="pkg-filter" type="search" data-i18n-placeholder="pathSearch" placeholder="Filter folder path..." oninput="renderPackages()">
  <label><input id="pkg-only-conflicts" type="checkbox" onchange="renderPackages()"> <span data-i18n="onlyRealConflicts">Only real conflicts</span></label>
  <label><input id="pkg-show-compatible" type="checkbox" onchange="renderPackages()"> <span data-i18n="showCompatibleDifferences">Show compatible differences</span></label>
</div>
```

- [ ] **Step 2: Render shared statuses and file summaries**

At the start of `renderPackages()`, build the shared status index and read both
toggle states. Filter only package rows whose aggregate summary has a true
conflict when `pkg-only-conflicts` is checked. Build file headers with DOM APIs,
including counts and a right-side open button:

```js
const versionIndex = PackageManagerModel.buildVersionStatusIndex(packageData);
const onlyConflicts = document.getElementById('pkg-only-conflicts').checked;
const showCompatible = document.getElementById('pkg-show-compatible').checked;

function openPackageJson(absPath) {
  vscode.postMessage({ type: 'openPackageJson', absPath });
}
```

Use `getOccurrenceVersionStatus(versionIndex, occurrence)` for every row.
Always show a warning marker for `conflict`; show the compatible marker and
count only when `showCompatible` is true. Keep the declared version visible.
Make the package-name button call the existing focused `openPackageManager`.

- [ ] **Step 3: Style the compact controls and statuses**

Add layout classes for `.pkg-actions`, toggle labels, `.pkg-folder-summary`,
`.pkg-open-file`, `.pkg-status-compatible`, and `.pkg-status-conflict`. Use VS
Code theme variables and the existing amber/success colors; do not introduce
fixed light-theme backgrounds.

- [ ] **Step 4: Add English and German copy**

Add matching keys in both dictionaries:

```js
btnOpenPackageManager: "Open package manager",
onlyRealConflicts: "Only real conflicts",
showCompatibleDifferences: "Show compatible differences",
openPackageJson: "Open package.json",
conflictCount: "{count} conflict(s)",
compatibleCount: "{count} compatible difference(s)",
statusIdentical: "Identical",
statusCompatible: "Compatible",
statusConflict: "Conflict",
```

Use German equivalents: `Paketmanager öffnen`, `Nur echte Konflikte`,
`Kompatible Unterschiede anzeigen`, `package.json öffnen`, `Konflikt(e)`,
`kompatible Abweichung(en)`, `Identisch`, `Kompatibel`, and `Konflikt`.

- [ ] **Step 5: Verify and commit the sidebar**

```powershell
node --check src/webview/main.js
node --check src/webview/i18n.js
node -e "const fs=require('fs'); const s=fs.readFileSync('src/webview/i18n.js','utf8'); for (const key of ['btnOpenPackageManager','onlyRealConflicts','showCompatibleDifferences','openPackageJson']) if ((s.match(new RegExp(key + ':', 'g')) || []).length !== 2) process.exit(1)"
git diff --check
git add src/webview/index.html src/webview/main.js src/webview/styles.css src/webview/i18n.js
git commit -m "feat: show package conflicts in sidebar"
```

Expected: all checks exit 0 and only the four sidebar/webview files are staged.

### Task 4: Full manager tree, full-height detail, and bulk selection

**Files:**
- Modify: `src/webview/package-manager.html:28-82`
- Modify: `src/webview/package-manager.js:1-610`
- Modify: `src/webview/package-manager.css:175-365,630-665`
- Modify: `src/webview/i18n.js`

**Interfaces:**
- Consumes: the Task 1 status APIs and Task 2 `openPackageJson` route.
- Produces: automatic first selection, explorer filters/statuses/counts, direct file opening, visible legend, `pkg-select-all`, and full-height detail flow.

- [ ] **Step 1: Replace the placeholder with filters, legend, and select-all**

Remove `#detail-empty`. Add the explorer controls and legend near the path
search, and add select-all before deselect-all:

```html
<div class="explorer-controls">
  <label><input id="pkg-only-conflicts" type="checkbox"> <span data-i18n="onlyRealConflicts">Only real conflicts</span></label>
  <label><input id="pkg-show-compatible" type="checkbox"> <span data-i18n="showCompatibleDifferences">Show compatible differences</span></label>
  <div class="status-legend" aria-label="Version status">
    <span class="status-identical" data-i18n="statusIdentical">Identical</span>
    <span class="status-compatible" data-i18n="statusCompatible">Compatible</span>
    <span class="status-conflict" data-i18n="statusConflict">Conflict</span>
  </div>
</div>
```

```html
<div class="selection-actions">
  <button id="pkg-select-all" class="link-button" type="button" data-i18n="selectAll">Select all</button>
  <button id="pkg-select-none" class="link-button" type="button" data-i18n="selectNone">Deselect all</button>
</div>
```

- [ ] **Step 2: Auto-select the first package and remove empty-detail logic**

After accepting a state without an explicit target, select the first dependency
from the first non-empty file:

```js
function createTarget(file, dep) {
  return { type: 'package', value: dep.name, version: dep.version, absPath: file.absPath };
}

function selectFirstTarget() {
  const file = packageFiles.find(item => item.deps.length > 0);
  if (!file) return;
  focusManualTarget(createTarget(file, file.deps[0]));
}
```

Invoke this only when no valid `focusTarget` exists. `renderDetail()` hides
`#detail-content` only for a truly empty scan and no longer reads or toggles
`#detail-empty`.

- [ ] **Step 3: Enrich and filter the path explorer**

Build the shared version index inside `renderExplorer()`. Keep path filtering
path-only, then filter each file's dependency rows by aggregate package
conflict when `pkg-only-conflicts` is enabled. Render path counts, an
`openPackageJson` icon button, package type, version, and occurrence status.

```js
function requestOpenPackageJson(absPath) {
  vscode.postMessage({ type: 'openPackageJson', absPath });
}
```

Conflict entries always receive a visible marker and title. Compatible entries
receive one only when the compatible toggle is enabled. Clicking any package
entry still calls `focusManualTarget`; therefore clicking a displayed conflict
opens its detail immediately.

- [ ] **Step 4: Implement select-all and filter events**

```js
element('pkg-select-all').addEventListener('click', () => {
  selectedKeys = model.createSelection(occurrences);
  renderDetail();
});
element('pkg-select-none').addEventListener('click', () => {
  selectedKeys.clear();
  renderDetail();
});
element('pkg-only-conflicts').addEventListener('change', renderExplorer);
element('pkg-show-compatible').addEventListener('change', renderExplorer);
```

In `updateManualPreview()`, disable select-all only when every occurrence is
already selected and disable deselect-all only when none are selected.

- [ ] **Step 5: Make the detail column use the available height**

Replace the fixed list maxima in project mode with a flex layout:

```css
.manager-layout {
  height: calc(100vh - 230px);
  min-height: 520px;
}
.detail-panel,
.detail-content {
  min-height: 0;
  height: 100%;
}
.detail-content {
  display: flex;
  flex-direction: column;
}
.occurrence-list,
.preview-panel {
  min-height: 120px;
  flex: 1 1 0;
}
.occurrence-list,
.preview-list {
  max-height: none;
  overflow: auto;
}
.action-bar {
  flex: 0 0 auto;
}
```

Keep the existing narrow-screen media query usable by switching the manager
back to `height: auto` and bounded explorer/detail lists below 760px.

- [ ] **Step 6: Verify and commit the full manager**

```powershell
node --check src/webview/package-manager.js
node --check src/webview/package-manager-model.js
node -e "const fs=require('fs'); const h=fs.readFileSync('src/webview/package-manager.html','utf8'); for (const id of ['pkg-select-all','pkg-only-conflicts','pkg-show-compatible']) if (!h.includes('id=\"' + id + '\"')) process.exit(1); if (h.includes('id=\"detail-empty\"')) process.exit(1)"
npm run compile
git diff --check
git add src/webview/package-manager.html src/webview/package-manager.js src/webview/package-manager.css src/webview/i18n.js
git commit -m "feat: improve package manager overview"
```

Expected: syntax, contract, compile, and diff checks exit 0; the instructional
detail block is absent.

### Task 5: Documentation, change log, and final verification

**Files:**
- Modify: `README.md:70-80`
- Modify: `CHANGELOG.md:5-25`
- Modify: `AI_CHANGES.md:1-20`

**Interfaces:**
- Consumes: completed behavior from Tasks 1-4.
- Produces: user-facing feature documentation and the mandatory AI change-log entry.

- [ ] **Step 1: Document the final behavior**

Update the package-manager README section and Unreleased changelog with:

```md
- Root-aware compatibility distinguishes intentional library peer ranges from real version conflicts.
- Conflict filters, compatible-difference visibility, versions, and status counts are shared by the sidebar and full package manager.
- Scanned package.json files can be opened directly, and the package manager can be opened without choosing a package first.
- The detail pane uses the full editor height and offers Select all and Deselect all actions.
```

- [ ] **Step 2: Add the required AI change entry**

Add a dated `2026-07-22 - Codex (GPT-5)` entry listing every implementation
file, all commands actually run, the implementation commit hashes, and the note
that no new dependency or automated test file was added.

- [ ] **Step 3: Run the complete verification set**

```powershell
node --check src/webview/main.js
node --check src/webview/package-manager-model.js
node --check src/webview/package-manager.js
node --check src/webview/i18n.js
npm run compile
vsce package
git diff --check
git status --short --branch
```

Also rerun the Task 1 compatibility script and the Task 3/4 translation and
HTML contract commands. Expected: all checks exit 0; `vsce package` creates a
VSIX for the unchanged current extension version; `AGENTS.md` remains the only
unrelated unstaged user file.

- [ ] **Step 4: Commit documentation and verification metadata**

```powershell
git add README.md CHANGELOG.md AI_CHANGES.md
git commit -m "docs: document package compatibility workflow"
git status --short --branch
git log --oneline --decorate -n 8
```

Expected: implementation and documentation commits are present locally; no
push or Marketplace publish occurs without a separate user request.
