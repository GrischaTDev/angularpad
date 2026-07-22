# Package Version Compatibility and Navigation Design

## Goal

AngularPad should distinguish real dependency conflicts from intentional
differences between a workspace root version and a compatible library
`peerDependency`. Package information and conflicts should also be usable
directly from both the sidebar and the full-size package manager, with direct
navigation to each scanned `package.json`.

## Scope

This change covers:

- a shared, conservative version-compatibility classification;
- optional visibility of compatible textual differences;
- conflict filters and status summaries in both package views;
- visible versions and statuses in the full package-manager path explorer;
- direct opening of scanned `package.json` files in VS Code;
- opening the full package manager without first editing a package;
- select-all in addition to the existing deselect-all action; and
- a full-height package detail layout without the large empty hint block.

Automatic rescanning after file saves, copying paths, and lockfile resolution
are outside this change.

## Compatibility Rules

For each package name, the occurrence in the workspace root `package.json` is
the reference. AngularPad classifies occurrences as follows:

1. The version text is identical to the root reference: `identical`.
2. A nested occurrence is a `peerDependency`, its text differs, and its range
   contains the complete root range: `compatible`.
3. Every other differing occurrence: `conflict`.

For example, a root dependency of `~21.2.0` is fully contained by a library
peer range of `^21.2.0`, so the library occurrence is compatible. The reverse
combination is a conflict because `^21.2.0` also permits versions outside
`~21.2.0`.

The comparison supports conservative numeric SemVer forms needed for this
classification: exact versions, caret ranges, and tilde ranges. Unsupported or
non-registry specifications such as `workspace:`, `file:`, Git URLs, aliases,
wildcards, comparator chains, and ambiguous root declarations are never
silently treated as compatible. Exact textual equality still remains
identical.

If there is no unambiguous root reference, differing occurrences remain real
conflicts. A package receives an aggregate conflict status when at least one
occurrence is a conflict.

The compatibility functions live in `package-manager-model.js`, which is
already loaded by the sidebar and the full package-manager webview. Both views
therefore use the same classification and cannot disagree about warnings.

## Sidebar Packages View

The sidebar keeps scanning as an explicit action and adds a separate
"Open package manager" button. The path search remains directly below the
primary actions.

Two view controls are added:

- "Only real conflicts" filters package rows and hides files without matching
  conflict rows.
- "Show compatible differences" exposes compatible status markers and counts
  but never presents them as warnings.

Every package-file header shows its package count and real-conflict count. When
compatible differences are enabled, it also shows their count. A file action
at the right opens that scanned `package.json` in a normal VS Code editor.

Package rows continue to show dependency type and version. Their status marker
uses the shared classification. Clicking a package opens or reuses the full
package-manager editor focused on that package.

## Full-Size Package Manager

The package manager can be opened in three ways:

- from an existing package or scope edit action;
- from the new sidebar button; or
- from a contributed VS Code command, `AngularPad: Open Package Manager`.

Opening without a target scans the workspace and automatically selects the
first package in the first scanned `package.json`. The path explorer therefore
remains immediately usable and the right detail area is never occupied by a
large instructional placeholder.

The path explorer shows, for every expanded package entry:

- package name;
- dependency type;
- declared version; and
- identical, compatible, or conflict status when applicable.

Path headers show the same counts as the sidebar and contain the direct file
open action. "Only real conflicts" and "Show compatible differences" affect
the explorer display only; they do not change an already selected edit target
or silently alter its selection.

Selecting a conflict focuses its normal package detail. A compact legend
explains identical, compatible, and conflict states.

The detail pane starts at the top of the right column and uses its full
available height. Occurrences and the live preview grow within that space, and
the action bar remains visible at the bottom. The instructional
"Select a package in the path explorer" block is removed.

The occurrence toolbar contains both "Select all" and "Deselect all". Each
action operates on all occurrences of the currently focused package or scope,
independent of the explorer display filters, and immediately refreshes the
existing live preview.

## Extension Messages and File Navigation

Opening the package manager without a target uses the existing reusable panel
instance with an optional target. Its state message continues to carry the
latest scan result and only includes focus information when a target exists.

Both webviews request file opening through an `openPackageJson` message. The
extension accepts only an absolute path that occurs in a fresh workspace
dependency scan. It then opens the document with VS Code's text-document API.
Unknown, stale, or unreadable paths are rejected and produce a warning instead
of being opened.

No external comparison file can be opened through this route because external
files are read-only references and are not part of the scanned local package
list.

## Error Handling and Conservative Fallbacks

- An empty scan leaves the existing empty-state messaging in place.
- An unsupported version format is not reported as compatible.
- A failed file-open request displays a warning and keeps the current view
  state.
- Applying versions retains the current validation, preview, and per-file
  failure behavior.
- Filters with no matches show a small local empty state rather than changing
  the underlying scan data.

## Verification

No additional test files are required, following the user's stated preference.
The implementation will be checked with:

- JavaScript syntax checks for changed webview files;
- TypeScript compilation;
- focused executable checks for exact, caret, tilde, subset, reverse-subset,
  unsupported-format, missing-root, and real-conflict cases;
- English/German translation-key parity;
- source checks for both open-manager entry points, validated file opening,
  select-all/deselect-all, and removal of the detail placeholder; and
- `git diff --check`.
