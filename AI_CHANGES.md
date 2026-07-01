# AI_CHANGES.md

Project-local log of AI-made changes. Every AI agent that changes files in this
repository must add an entry here in the same change set.

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
