# AGENTS.md

Repo-local instructions for AI agents working on AngularPad.

## General Rules

- Keep changes scoped to the requested task.
- Prefer existing project patterns over new abstractions.
- Do not revert user changes unless the user explicitly asks for it.
- Before editing, check `git status --short --branch`.
- After editing, run the smallest useful verification command and report the result.
- Every AI agent that changes this project must update `AI_CHANGES.md` in the same change set.

## AI Change Log Requirement

When an AI changes files, add a new entry to `AI_CHANGES.md` before committing or finishing.

Each entry should include:

- Date
- AI name/model if known
- What changed
- Files touched
- Commands run for verification
- Publish/commit details if relevant

Use this format:

```md
## YYYY-MM-DD - AI name

- Changed: Short summary.
- Files: `file-a`, `file-b`.
- Verification: `command` passed, or note why it was not run.
- Notes: Optional context, commit hash, publish result, or follow-up.
```

If the AI only investigates and makes no file changes, no log entry is required.

## Release / Marketplace Publish Flow

AngularPad is a VS Code extension published as `GrischaTDev.angularpad`.

Use this flow for a new release:

1. Check the current workspace state.

```powershell
git status --short --branch
```

2. Check the latest Marketplace version.

```powershell
vsce show GrischaTDev.angularpad --json
```

If the public API or UI still shows an older version after a recent publish, verify duplicate state with:

```powershell
vsce publish --packagePath angularpad-X.Y.Z.vsix --skip-duplicate
```

3. Choose the next SemVer version.

- The new version must be greater than the latest Marketplace version.
- Do not run `vsce publish patch`, `minor`, or `major` when local `package.json` is behind the Marketplace version.
- In that case, set the exact intended version explicitly.

4. Update version metadata.

Update all relevant files:

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`

Recommended command for package metadata:

```powershell
npm version X.Y.Z --no-git-tag-version
```

Then update `CHANGELOG.md` manually for the release notes and version link.

5. Build and package.

```powershell
npm run compile
vsce package
```

Expected output:

- `npm run compile` exits with code 0.
- `vsce package` creates `angularpad-X.Y.Z.vsix`.

6. Publish the exact VSIX package.

```powershell
vsce publish --packagePath angularpad-X.Y.Z.vsix
```

Using `--packagePath` avoids accidentally repackaging a different working-tree state.

7. Verify publish result.

```powershell
vsce publish --packagePath angularpad-X.Y.Z.vsix --skip-duplicate
vsce show GrischaTDev.angularpad --json
```

Notes:

- `vsce publish` may say the Marketplace URL needs a few minutes.
- `vsce show` or the public Marketplace UI may lag briefly.
- If `--skip-duplicate` reports that version `X.Y.Z` is already published, the Marketplace accepted the version.

8. Commit and push release metadata.

```powershell
git status --short --branch
git add package.json package-lock.json CHANGELOG.md AI_CHANGES.md
git commit -m "Release X.Y.Z"
git push origin main
```

If additional files were intentionally changed, stage them explicitly.

9. Final verification before reporting done.

```powershell
git status --short --branch
git log --oneline --decorate -n 3
```

Report:

- Published version
- VSIX file name
- Verification commands
- Commit hash
- Push target
- Any Marketplace cache delay if observed

## Current Release Notes

As of 2026-07-01, the repo was released as `0.7.0`.

Important context from that release:

- The Marketplace already had `0.6.1` while the local repo still said `0.4.0`.
- The release was therefore bumped explicitly to `0.7.0`.
- `package-lock.json` also needed its root version updated.
- `vsce publish --packagePath angularpad-0.7.0.vsix` succeeded.
- A duplicate-safe second publish confirmed `Version 0.7.0 is already published. Skipping publish.`
