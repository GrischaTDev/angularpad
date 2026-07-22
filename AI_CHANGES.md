# AI_CHANGES.md

Project-local log of AI-made changes. Every AI agent that changes files in this
repository must add an entry here in the same change set.

## 2026-07-22 - Codex (GPT-5)

- Changed: Fixed root-aware compatibility when the frontend root package.json is nested below the opened VS Code workspace, such as `angular/package.json` inside a solution folder.
- Files: `src/webview/package-manager-model.js`, `CHANGELOG.md`, `AI_CHANGES.md`.
- Verification: A one-off regression check failed before the fix for root `~21.2.0` versus nested peer `^21.2.0` under the `angular/` folder and passed afterward; workspace-root, reverse-subset, ambiguous-root, JavaScript syntax, TypeScript compile, and `git diff --check` checks passed.
- Notes: Reference selection now uses the shallowest authoritative non-peer occurrence per package instead of requiring the literal folder label `root`. No test file or dependency was added; the local user change in `AGENTS.md` remains untouched.

## 2026-07-22 - Codex (GPT-5)

- Changed: Released AngularPad `0.10.0` to the VS Code Marketplace and aligned the release metadata for the root-aware package compatibility and navigation update.
- Files: `package.json`, `package-lock.json`, `CHANGELOG.md`, `AI_CHANGES.md`.
- Verification: `npm run compile` passed; `vsce package` created `angularpad-0.10.0.vsix` with 24 files; `vsce publish --packagePath angularpad-0.10.0.vsix` published successfully; duplicate-safe publish reported `Version 0.10.0 is already published. Skipping publish.`
- Notes: The Marketplace accepted version `0.10.0`; `vsce show` still returned `0.9.0` immediately afterward because the Marketplace API cache had not refreshed yet.

## 2026-07-22 - Codex (GPT-5)

- Changed: Implemented root-aware peer-range compatibility, real-conflict and compatible-difference filters, status-rich package trees, validated package.json navigation, targetless package-manager opening, automatic first selection, select-all, and a full-height detail layout.
- Files: `package.json`, `src/extension.ts`, `src/provider.ts`, `src/package-manager-panel.ts`, `src/webview/package-manager-model.js`, `src/webview/index.html`, `src/webview/main.js`, `src/webview/styles.css`, `src/webview/package-manager.html`, `src/webview/package-manager.js`, `src/webview/package-manager.css`, `src/webview/i18n.js`, `README.md`, `CHANGELOG.md`, `AI_CHANGES.md`.
- Verification: Focused executable compatibility checks passed for exact, caret, tilde, subset, reverse-subset, unsupported-format, missing-root, and real-conflict behavior; JavaScript syntax, UI message/element contracts, English/German key parity, `npm run compile`, `vsce package`, and `git diff --check` passed.
- Notes: Implementation commits are `64fcb0e`, `59cc51d`, `46c3890`, and `baa61a5`. No dependency, lockfile integration, automated rescan, path-copy action, or automated test file was added; the local user change in `AGENTS.md` remains untouched.

## 2026-07-22 - Codex (GPT-5)

- Changed: Added the implementation plan for root-aware package-version compatibility, package status navigation, full-height editing, and bulk selection.
- Files: `docs/superpowers/plans/2026-07-22-package-version-compatibility-navigation.md`, `AI_CHANGES.md`.
- Verification: Plan self-review confirmed complete specification coverage, no placeholders, and consistent interfaces and command names; `git diff --check` passed.
- Notes: The plan preserves the external comparison workflow, adds no dependency or test file, and leaves the local user change in `AGENTS.md` untouched. Implementation is pending.

## 2026-07-22 - Codex (GPT-5)

- Changed: Documented the approved design for root-aware package-version compatibility, conflict filtering, richer package trees, direct package.json navigation, targetless package-manager opening, select-all, and a full-height detail layout.
- Files: `docs/superpowers/specs/2026-07-22-package-version-compatibility-navigation-design.md`, `AI_CHANGES.md`.
- Verification: The specification self-review found no placeholders, contradictions, uncovered requirements, or ambiguous behavior; `git diff --check` passed.
- Notes: The design was approved in sections. Implementation remains pending until the written specification is reviewed.

## 2026-07-21 - Codex (GPT-5)

- Changed: Released AngularPad `0.9.0` to the VS Code Marketplace and aligned the release metadata and package exclusions.
- Files: `.vscodeignore`, `package.json`, `package-lock.json`, `CHANGELOG.md`, `AI_CHANGES.md`.
- Verification: `npm run compile` passed; `vsce package` created the cleaned `angularpad-0.9.0.vsix` with 24 files and without temporary `.superpowers` artifacts; `vsce publish --packagePath angularpad-0.9.0.vsix` published successfully; duplicate-safe publish reported `Version 0.9.0 is already published. Skipping publish.`
- Notes: The Marketplace accepted version `0.9.0`; `vsce show` still returned `0.8.0` immediately afterward because the Marketplace API cache had not refreshed yet.

## 2026-07-21 - Codex (GPT-5)

- Changed: Replaced the package version modal with a reusable full-size VS Code editor tab, changed the sidebar filter to package.json paths, added default bulk selection with deselect-all and automatic live previews, and added read-only external package.json comparison via file picker or drag-and-drop with selective local version transfer.
- Files: `.vscodeignore`, `CHANGELOG.md`, `README.md`, `docs/superpowers/plans/2026-07-21-package-manager-editor.md`, `src/package-manager-panel.ts`, `src/provider.ts`, `src/webview/i18n.js`, `src/webview/index.html`, `src/webview/main.js`, `src/webview/styles.css`, `src/webview/package-manager-model.js`, `src/webview/package-manager.html`, `src/webview/package-manager.css`, `src/webview/package-manager.js`, `AI_CHANGES.md`.
- Verification: `node --check` passed for all changed JavaScript files; `npm run compile` passed; focused source/UI contract checks confirmed path-only filtering, modal removal, beside-editor placement, read-only external file handling, asset order, and English/German key parity; `git diff --check` passed.
- Notes: The user explicitly declined an isolated worktree and additional automated tests. No package version was bumped, published, or installed; the existing user change in `AGENTS.md` was left untouched.

## 2026-07-21 - Codex (GPT-5)

- Changed: Documented the approved design and implementation plan for a full-size package manager editor tab with read-only external `package.json` comparison, and excluded temporary visual brainstorming artifacts.
- Files: `.gitignore`, `docs/superpowers/specs/2026-07-21-package-manager-editor-design.md`, `docs/superpowers/plans/2026-07-21-package-manager-editor.md`, `AI_CHANGES.md`.
- Verification: The specification and plan self-review found no placeholders, contradictions, uncovered requirements, or inconsistent interfaces; `git diff --check` passed.
- Notes: Design variant A and its integrated external comparison mode are approved; implementation is pending.

## 2026-07-01 - Codex (GPT-5)

- Changed: Released AngularPad `0.7.0` to the VS Code Marketplace and aligned release metadata.
- Files: `package.json`, `package-lock.json`, `CHANGELOG.md`.
- Verification: `npm run compile` passed; `vsce package` created `angularpad-0.7.0.vsix`; `vsce publish --packagePath angularpad-0.7.0.vsix` reported the publish as done.
- Notes: Commit `45d769c` (`Release 0.7.0`) was pushed to `origin/main`; duplicate-safe publish reported `Version 0.7.0 is already published. Skipping publish.`

## 2026-07-01 - Codex (GPT-5)

- Changed: Added repo-local agent instructions and an AI change log requirement.
- Files: `AGENTS.md`, `AI_CHANGES.md`, `.vscodeignore`.
- Verification: `git diff --check` had no whitespace errors; `vsce package` passed and did not include `AGENTS.md` or `AI_CHANGES.md` in the VSIX.
- Notes: Documents the release flow, version update rules, build/publish commands, and mandatory AI change logging. Excludes the agent docs from future VSIX packages.

## 2026-07-01 - Codex (GPT-5)

- Changed: Added scoped package group updates for Package Version Manager, clarified the Workspace tab description, and prepared release `0.8.0`.
- Files: `src/webview/main.js`, `src/webview/i18n.js`, `src/webview/styles.css`, `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `AI_CHANGES.md`.
- Verification: `npm run compile`, `git diff --check`, `vsce package`, and `vsce publish --packagePath angularpad-0.8.0.vsix` passed.
- Notes: Scoped dependencies such as `@nx/*` or `@lis/*` can be selected together through the package modal and saved with the existing diff preview/apply flow. Marketplace publish reported `Published GrischaTDev.angularpad v0.8.0.`
