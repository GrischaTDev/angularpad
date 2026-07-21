# Package Manager Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small package version modal with a reusable, full-size VS Code editor tab that provides path-first navigation, detailed selection, automatic live preview, and read-only comparison with an external `package.json`.

**Architecture:** Keep filesystem scanning and writes in `src/packages.ts`. Add a singleton `PackageManagerPanel` in the extension host and a dedicated editor webview with pure state helpers shared by browser code and Node tests. The existing sidebar remains the launcher and path-filtered overview, while both views refresh from the same scan after writes.

**Tech Stack:** VS Code Extension API, TypeScript 5, plain HTML/CSS/JavaScript webviews, Node 20 built-in test runner.

## Global Constraints

- Do not add npm dependencies or change package versions.
- Preserve `src/packages.ts` as the only filesystem scan/write implementation.
- Search only relative folder and full `package.json` paths; never dependency names.
- Reuse one `WebviewPanel` in `vscode.ViewColumn.Beside`.
- Preserve VS Code theme variables, keyboard focus, and English/German UI strings.
- Remove the old package modal and two-stage preview flow completely.
- Keep external comparison files read-only and session-scoped; transfer only versions for packages that already exist locally.
- Update `AI_CHANGES.md` in the implementation change set and do not stage the user's `AGENTS.md` modification.

---

### Task 1: Testable Package Manager State Model

**Files:**
- Create: `src/webview/package-manager-model.js`
- Create: `test/package-manager-model.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PackageFileInfo`-shaped plain objects from `src/packages.ts`.
- Produces: `filterPackageFiles(files, query)`, `getTargetOccurrences(files, target)`, `createOccurrenceKey(occurrence)`, `createSelection(occurrences)`, `buildPreview(occurrences, selectedKeys, newVersion)`, and `getSaveStatus(newVersion, selectedCount, changes)` on `globalThis.PackageManagerModel` and `module.exports`.

- [ ] **Step 1: Add the Node test command and write failing state-model tests**

Add to `package.json`:

```json
"test": "npm run compile && node --test test/*.test.js"
```

Create `test/package-manager-model.test.js` with real fixtures and assertions:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/webview/package-manager-model.js');

const files = [
  {
    folder: 'apps/customer-portal',
    absPath: 'D:\\repo\\apps\\customer-portal\\package.json',
    deps: [
      { name: '@angular/core', version: '^21.0.0', type: 'dependencies' },
      { name: '@nx/angular', version: '^22.1.0', type: 'devDependencies' },
    ],
  },
  {
    folder: 'libs/shared/ui',
    absPath: 'D:\\repo\\libs\\shared\\ui\\package.json',
    deps: [
      { name: '@angular/core', version: '^20.3.1', type: 'peerDependencies' },
      { name: '@nx/js', version: '^22.1.0', type: 'devDependencies' },
    ],
  },
];

test('filters package files by relative and full path without matching dependency names', () => {
  assert.deepEqual(model.filterPackageFiles(files, 'CUSTOMER'), [files[0]]);
  assert.deepEqual(model.filterPackageFiles(files, 'libs/shared'), [files[1]]);
  assert.deepEqual(model.filterPackageFiles(files, '@angular/core'), []);
});

test('focuses every occurrence of one package', () => {
  const occurrences = model.getTargetOccurrences(files, { type: 'package', value: '@angular/core' });
  assert.equal(occurrences.length, 2);
  assert.deepEqual(occurrences.map(item => item.folder), ['apps/customer-portal', 'libs/shared/ui']);
});

test('focuses every package in one scope', () => {
  const occurrences = model.getTargetOccurrences(files, { type: 'scope', value: '@nx' });
  assert.deepEqual(occurrences.map(item => item.name), ['@nx/angular', '@nx/js']);
});

test('selects all occurrences by default and previews only effective selected changes', () => {
  const occurrences = model.getTargetOccurrences(files, { type: 'package', value: '@angular/core' });
  const selection = model.createSelection(occurrences);
  assert.equal(selection.size, 2);
  selection.delete(model.createOccurrenceKey(occurrences[0]));
  const changes = model.buildPreview(occurrences, selection, '^21.0.0');
  assert.deepEqual(changes.map(change => change.folder), ['libs/shared/ui']);
});

test('disables saving for an empty version, no selection, or no effective changes', () => {
  assert.equal(model.getSaveStatus('', 1, [{}]).canSave, false);
  assert.equal(model.getSaveStatus('^21.0.0', 0, [{}]).canSave, false);
  assert.equal(model.getSaveStatus('^21.0.0', 1, []).canSave, false);
  assert.equal(model.getSaveStatus('^21.0.0', 1, [{}]).canSave, true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/package-manager-model.test.js`

Expected: FAIL because `src/webview/package-manager-model.js` does not exist.

- [ ] **Step 3: Implement the complete pure model**

Use a browser/CommonJS wrapper and these exact rules:

```js
(function (root, factory) {
  const api = factory();
  root.PackageManagerModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function normalize(value) {
    return String(value || '').replace(/\\/g, '/').toLowerCase();
  }

  function filterPackageFiles(files, query) {
    const filter = normalize(query).trim();
    if (!filter) return [...files];
    return files.filter(file =>
      normalize(file.folder).includes(filter) || normalize(file.absPath).includes(filter)
    );
  }

  function getPackageScope(name) {
    if (!name.startsWith('@')) return '';
    const slashIndex = name.indexOf('/');
    return slashIndex > 0 ? name.slice(0, slashIndex) : '';
  }

  function getTargetOccurrences(files, target) {
    const occurrences = [];
    files.forEach(file => file.deps.forEach(dep => {
      const matches = target.type === 'scope'
        ? getPackageScope(dep.name) === target.value
        : dep.name === target.value;
      if (matches) occurrences.push({ ...dep, folder: file.folder, absPath: file.absPath });
    }));
    return occurrences.sort((a, b) =>
      a.name.localeCompare(b.name) || a.folder.localeCompare(b.folder) || a.type.localeCompare(b.type)
    );
  }

  function createOccurrenceKey(item) {
    return [item.absPath, item.name, item.type].join('\u0000');
  }

  function createSelection(occurrences) {
    return new Set(occurrences.map(createOccurrenceKey));
  }

  function buildPreview(occurrences, selectedKeys, newVersion) {
    return occurrences
      .filter(item => selectedKeys.has(createOccurrenceKey(item)) && item.version !== newVersion)
      .map(item => ({ ...item, oldVersion: item.version, newVersion }));
  }

  function getSaveStatus(newVersion, selectedCount, changes) {
    if (!newVersion.trim()) return { canSave: false, reason: 'empty-version' };
    if (selectedCount === 0) return { canSave: false, reason: 'no-selection' };
    if (changes.length === 0) return { canSave: false, reason: 'no-changes' };
    return { canSave: true, reason: '' };
  }

  return {
    filterPackageFiles,
    getPackageScope,
    getTargetOccurrences,
    createOccurrenceKey,
    createSelection,
    buildPreview,
    getSaveStatus,
  };
});
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test test/package-manager-model.test.js`

Expected: 5 tests pass, 0 fail.

- [ ] **Step 5: Commit the state model**

```powershell
git add package.json src/webview/package-manager-model.js test/package-manager-model.test.js
git commit -m "test: add package manager state model"
```

### Task 2: Singleton VS Code Package Manager Panel

**Files:**
- Create: `src/package-manager-panel.ts`
- Create: `test/package-manager-panel.test.js`
- Modify: `src/provider.ts`

**Interfaces:**
- Consumes: `getWorkspaceDependencies(): Promise<PackageFileInfo[]>`, `applyVersionChanges(changes): Promise<AppliedChange[]>`, and a `PackageManagerTarget` from the sidebar.
- Produces: `PackageManagerPanel.show(target): Promise<void>` and refresh callback `(packages: PackageFileInfo[]) => void`.

- [ ] **Step 1: Write a failing panel lifecycle test**

Create a fake `vscode.window.createWebviewPanel`, capture its message listener, and assert:

```js
test('reuses the editor panel and posts the newest focus target after ready', async () => {
  const first = { type: 'package', value: '@angular/core', version: '^21.0.0', absPath: 'D:\\repo\\package.json' };
  const second = { type: 'scope', value: '@nx', version: '^22.1.0', absPath: 'D:\\repo\\apps\\a\\package.json' };
  const manager = new PackageManagerPanel(context, () => {}, dependencies);
  await manager.show(first);
  await messageListener({ type: 'ready' });
  await manager.show(second);

  assert.equal(createCalls, 1);
  assert.equal(revealCalls, 1);
  assert.deepEqual(posted.at(-1).target, second);
});
```

Stub `vscode` through `node:module` before requiring `../out/package-manager-panel.js`. Inject `dependencies.scan`, `dependencies.apply`, `dependencies.showInformationMessage`, and `dependencies.showWarningMessage` so the test never accesses the filesystem or UI.

- [ ] **Step 2: Run compile plus the panel test and verify RED**

Run: `npm run compile` and then `node --test test/package-manager-panel.test.js`

Expected: FAIL because `out/package-manager-panel.js` does not exist.

- [ ] **Step 3: Implement the panel and provider delegation**

Define these exact types and lifecycle:

```ts
export interface PackageManagerTarget {
  type: "package" | "scope";
  value: string;
  version: string;
  absPath: string;
}

interface PackageManagerPanelDependencies {
  scan: typeof getWorkspaceDependencies;
  apply: typeof applyVersionChanges;
  showInformationMessage(message: string): Thenable<unknown>;
  showWarningMessage(message: string): Thenable<unknown>;
}

export class PackageManagerPanel {
  private panel?: vscode.WebviewPanel;
  private target?: PackageManagerTarget;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onDependenciesChanged: (packages: PackageFileInfo[]) => void,
    private readonly dependencies: PackageManagerPanelDependencies = defaultDependencies,
  ) {}

  async show(target: PackageManagerTarget): Promise<void> {
    this.target = target;
    if (!this.panel) this.createPanel();
    else this.panel.reveal(vscode.ViewColumn.Beside);
    await this.postState();
  }
}
```

`createPanel()` must set `enableScripts`, restrict `localResourceRoots` to `src/webview`, load `package-manager.html`, clear `this.panel` on dispose, and process `ready`, `scan`, `applyVersionChanges`, and `close` messages. `postState()` scans once and posts `{ type: 'state', packages, target, language }`. Applying changes posts only validated `VersionChange[]`, reports success/failure counts, rescans, calls `onDependenciesChanged(packages)`, and posts the refreshed state.

In `NgCommanderViewProvider`, create one `PackageManagerPanel`, add an `openPackageManager` message case, and provide a callback that posts `{ type: 'dependencies', packages }` to the sidebar webview.

- [ ] **Step 4: Run compile and panel test and verify GREEN**

Run: `npm run compile` and then `node --test test/package-manager-panel.test.js`

Expected: lifecycle test passes and TypeScript exits 0.

- [ ] **Step 5: Commit the panel integration**

```powershell
git add src/package-manager-panel.ts src/provider.ts test/package-manager-panel.test.js
git commit -m "feat: add package manager editor panel"
```

### Task 3: Full-Size Package Manager Editor Webview

**Files:**
- Create: `src/webview/package-manager.html`
- Create: `src/webview/package-manager.js`
- Create: `src/webview/package-manager.css`
- Create: `test/package-manager-assets.test.js`
- Modify: `src/webview/i18n.js`

**Interfaces:**
- Consumes: `{ type: 'state', packages, target, language }` messages and `PackageManagerModel` functions from Task 1.
- Produces: `ready`, `scan`, `applyVersionChanges`, and `close` messages to `PackageManagerPanel`.

- [ ] **Step 1: Write failing asset-structure tests**

Assert that the new HTML contains `pkg-path-filter`, `pkg-explorer`, `pkg-detail`, `pkg-select-none`, `pkg-preview`, and `pkg-save`; that `package-manager-model.js` loads before `package-manager.js`; and that the editor script registers `input` and `change` listeners which call `updatePreview()`.

- [ ] **Step 2: Run the asset test and verify RED**

Run: `node --test test/package-manager-assets.test.js`

Expected: FAIL because the editor assets do not exist.

- [ ] **Step 3: Build the semantic editor layout**

Create `package-manager.html` with a CSP, a header containing title and scan button, a labeled full-width path filter, a two-column `<main>`, a path explorer `<aside>`, and a detail `<section>`. The detail contains the version input, selection counter, “Alles abwählen”, occurrence list, always-visible preview, close button, and disabled save button.

Create `package-manager.css` using only VS Code theme tokens for backgrounds, foregrounds, borders, focus outlines, inputs, and buttons. Use `minmax(260px, 32%) minmax(420px, 1fr)` for wide layouts and stack below 760 pixels. Give occurrence and preview regions independent overflow limits so the action bar remains visible.

- [ ] **Step 4: Implement live editor behavior**

In `package-manager.js`, maintain only:

```js
let packageFiles = [];
let focusTarget;
let activePath = '';
let occurrences = [];
let selectedKeys = new Set();
let newVersion = '';
let currentLang = 'en';
```

On `state`, update these values, activate `target.absPath` when available, create the default full selection, render the explorer and details, then call `updatePreview()`. Explorer filtering uses only `PackageManagerModel.filterPackageFiles`. Selecting a package or scope creates a new target and a fresh full selection. Checkbox changes mutate `selectedKeys`; version input changes `newVersion`; both call `updatePreview()` immediately. “Alles abwählen” clears the set and updates the preview. Save posts only the output of `buildPreview`, mapped to `{ absPath, name, type, newVersion }`.

- [ ] **Step 5: Add complete English and German strings**

Add keys for editor title, path search, package paths, selected count, select none, new version, live preview, empty states, scan, close, and dynamic save label. English and German must expose identical key sets.

- [ ] **Step 6: Run state, asset, and compile verification**

Run: `node --test test/package-manager-model.test.js test/package-manager-assets.test.js` and `npm run compile`.

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit the editor UI**

```powershell
git add src/webview/package-manager.html src/webview/package-manager.js src/webview/package-manager.css src/webview/i18n.js test/package-manager-assets.test.js
git commit -m "feat: build package manager editor UI"
```

### Task 4: Sidebar Path Filter and Modal Removal

**Files:**
- Modify: `src/webview/index.html`
- Modify: `src/webview/main.js`
- Modify: `src/webview/styles.css`
- Modify: `src/provider.ts`
- Modify: `test/package-manager-assets.test.js`

**Interfaces:**
- Consumes: `PackageManagerModel.filterPackageFiles` and `openPackageManager` provider message support.
- Produces: sidebar requests `{ type: 'openPackageManager', target }`.

- [ ] **Step 1: Extend the asset test for the new sidebar contract**

Assert that `index.html` loads `package-manager-model.js` before `main.js`, has the filter below the scan button, and no longer contains `package-modal`. Assert that `main.js` contains `openPackageManager` but no `pkgModalStage`, `previewOrApply`, or `openPackageModal`.

- [ ] **Step 2: Run the asset test and verify RED**

Run: `node --test test/package-manager-assets.test.js`

Expected: FAIL because the sidebar still contains the package modal and old functions.

- [ ] **Step 3: Replace sidebar filtering and launch actions**

Move `#pkg-filter` below the scan button and make both controls full width. Load the shared model before `main.js`. In `renderPackages()`, call `filterPackageFiles(packageData, filter)` and render every dependency of each returned file. Replace package and scope edit handlers with:

```js
function openPackageManager(type, value, version, absPath) {
  vscode.postMessage({
    type: 'openPackageManager',
    target: { type, value, version, absPath },
  });
}
```

Remove the modal HTML, modal CSS, `pkgModalStage`, `openPackageModal`, `openScopeModal`, `collectSelectedChanges`, `previewOrApply`, and modal-specific completion handling. Keep the post-save install banner; it is updated when refreshed dependency data arrives after panel writes.

- [ ] **Step 4: Update provider template asset replacement**

Create and replace `{{packageManagerModelUri}}` using the same restrictive local-resource configuration as existing webview assets.

- [ ] **Step 5: Run asset tests and compile verification**

Run: `node --test test/package-manager-assets.test.js test/package-manager-model.test.js` and `npm run compile`.

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit sidebar integration**

```powershell
git add src/provider.ts src/webview/index.html src/webview/main.js src/webview/styles.css test/package-manager-assets.test.js
git commit -m "refactor: open package edits in editor tab"
```

### Task 5: Read-Only External package.json Comparison

**Files:**
- Modify: `src/webview/package-manager-model.js`
- Modify: `src/webview/package-manager.html`
- Modify: `src/webview/package-manager.js`
- Modify: `src/webview/package-manager.css`
- Modify: `src/webview/i18n.js`
- Modify: `src/package-manager-panel.ts`
- Modify: `test/package-manager-model.test.js`
- Modify: `test/package-manager-panel.test.js`
- Modify: `test/package-manager-assets.test.js`

**Interfaces:**
- Consumes: external JSON text from native file selection or browser drag-and-drop and all scanned local `PackageFileInfo` objects.
- Produces: `parseExternalPackageJson(content)`, `buildExternalComparison(files, externalEntries)`, and `buildExternalPreview(comparisons, selectedKeys)` plus panel message `selectExternalPackageJson` and webview message `externalPackageJson`.

- [ ] **Step 1: Write failing comparison-model tests**

Extend `test/package-manager-model.test.js`:

```js
test('parses all supported external dependency sections', () => {
  const parsed = model.parseExternalPackageJson(JSON.stringify({
    dependencies: { '@angular/core': '^21.1.0' },
    devDependencies: { '@nx/angular': '^22.2.0' },
    peerDependencies: { rxjs: '^7.8.2' },
    optionalDependencies: { fsevents: '^2.3.3' },
  }));
  assert.deepEqual(parsed.entries.map(entry => entry.name), [
    '@angular/core', '@nx/angular', 'rxjs', 'fsevents',
  ]);
});

test('shows equal, different, local-only, external-only, and ambiguous packages', () => {
  const external = [
    { name: '@angular/core', version: '^21.1.0', type: 'dependencies' },
    { name: 'rxjs', version: '^7.8.1', type: 'dependencies' },
    { name: '@vendor/maps', version: '^4.2.0', type: 'dependencies' },
    { name: '@nx/angular', version: '^22.2.0', type: 'dependencies' },
    { name: '@nx/angular', version: '^23.0.0', type: 'devDependencies' },
  ];
  const comparison = model.buildExternalComparison(files, external);
  const statuses = Object.fromEntries(comparison.map(row => [row.name, row.status]));
  assert.equal(statuses['@angular/core'], 'different');
  assert.equal(statuses.rxjs, 'local-only');
  assert.equal(statuses['@vendor/maps'], 'external-only');
  assert.equal(statuses['@nx/angular'], 'ambiguous');
});

test('previews external versions only for explicitly selected local occurrences', () => {
  const comparison = model.buildExternalComparison(files, [
    { name: '@angular/core', version: '^21.1.0', type: 'dependencies' },
  ]);
  const occurrence = comparison.find(row => row.name === '@angular/core').localOccurrences[0];
  const selected = new Set([model.createOccurrenceKey(occurrence)]);
  const preview = model.buildExternalPreview(comparison, selected);
  assert.equal(preview.length, 1);
  assert.equal(preview[0].newVersion, '^21.1.0');
});
```

- [ ] **Step 2: Run model tests and verify RED**

Run: `node --test test/package-manager-model.test.js`

Expected: FAIL because the three comparison functions do not exist.

- [ ] **Step 3: Implement external parsing and comparison**

`parseExternalPackageJson` must reject non-object JSON, collect string versions from the same four sections as `src/packages.ts`, and return `{ entries }`. `buildExternalComparison` must create the union of external names and local names, retain every local occurrence, and derive `equal`, `different`, `local-only`, `external-only`, or `ambiguous`. `buildExternalPreview` must ignore unselected, external-only, equal, and ambiguous rows and map selected local occurrences to the unique external version.

- [ ] **Step 4: Run model tests and verify GREEN**

Run: `node --test test/package-manager-model.test.js`

Expected: all model tests pass.

- [ ] **Step 5: Write failing panel and asset tests for file loading**

Assert that `selectExternalPackageJson` invokes `vscode.window.showOpenDialog` for one JSON file, reads but never writes the returned URI, and posts `{ type: 'externalPackageJson', source, content }`. Assert that the HTML contains a comparison mode, add-file button, drop zone, comparison table, and external preview.

- [ ] **Step 6: Run panel and asset tests and verify RED**

Run: `npm run compile` followed by `node --test test/package-manager-panel.test.js test/package-manager-assets.test.js`.

Expected: FAIL because file selection and comparison markup are absent.

- [ ] **Step 7: Implement native selection, drag-and-drop, and integrated comparison mode**

In `PackageManagerPanel`, call:

```ts
const selected = await vscode.window.showOpenDialog({
  canSelectFiles: true,
  canSelectFolders: false,
  canSelectMany: false,
  openLabel: "package.json vergleichen",
  filters: { JSON: ["json"] },
});
```

Read the first URI as UTF-8 with a bounded size check and post its path plus content. Never pass the URI to `applyVersionChanges`.

In the webview, add `Projektübersicht` and `Externer Vergleich` modes. The add button sends `selectExternalPackageJson`; the drop zone accepts exactly one `.json` file and reads `file.text()`. Parse into session memory, render all comparison statuses, default to an empty transfer selection, expand differing local occurrences with full path/type/version, and feed only selected effective transfers into the existing live preview and save message. Preserve the reference data after local refreshes and clear it only when the user closes or replaces the comparison.

- [ ] **Step 8: Run comparison tests and compile verification**

Run: `npm test` and `npm run compile`.

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 9: Commit external comparison**

```powershell
git add src/package-manager-panel.ts src/webview test
git commit -m "feat: compare external package versions"
```

### Task 6: Documentation, AI Log, and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AI_CHANGES.md`
- Modify: `docs/superpowers/plans/2026-07-21-package-manager-editor.md`

**Interfaces:**
- Consumes: completed behavior from Tasks 1–4.
- Produces: user-facing documentation and a verified change record.

- [ ] **Step 1: Update user documentation**

Describe path-only filtering, the editor tab opening beside the active editor, singleton reuse, detailed occurrence paths, “Alles abwählen”, and the automatic preview. Add these changes under the current unreleased changelog section without changing the extension version.

- [ ] **Step 2: Update `AI_CHANGES.md` with exact evidence**

Add a 2026-07-21 entry listing every touched source, test, documentation, and plan file. Record exact test counts, `npm run compile`, and `git diff --check` results. Note that the Marketplace was not published.

- [ ] **Step 3: Run complete fresh verification**

Run:

```powershell
npm test
npm run compile
git diff --check
git status --short --branch
```

Expected: all Node tests pass, compilation exits 0, no whitespace errors are reported, and only intended implementation files plus the user's pre-existing `AGENTS.md` modification remain.

- [ ] **Step 4: Review the diff against every design requirement**

Confirm path-only filtering, singleton beside-panel behavior, path explorer, complete occurrence details, default selection, “Alles abwählen”, live preview, direct disabled save, refresh of both views, removal of old modal, theme tokens, English/German parity, and no new dependencies.

- [ ] **Step 5: Commit the completed feature**

```powershell
git add README.md CHANGELOG.md AI_CHANGES.md package.json src test docs/superpowers/plans/2026-07-21-package-manager-editor.md
git commit -m "feat: add full-size package manager editor"
```
