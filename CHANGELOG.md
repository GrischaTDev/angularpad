# Changelog

All notable changes to the **AngularPad** extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-07-01

### Added

- **Packages tab — Package Version Manager.** Scan every `package.json` in the
  workspace (excluding `node_modules`) and review dependencies grouped by folder
  location (root, lib, …).
  - Lists `dependencies`, `devDependencies`, `peerDependencies` and
    `optionalDependencies`, each with a type badge, plus a filter box.
  - Flags **version mismatches** with a ⚠ marker when the same package is used
    with different versions across files.
  - **Change a version across multiple files at once:** edit a package, pick via
    checkboxes which other `package.json` files containing that package should be
    updated too (search & replace).
  - **Diff preview** (old → new, per file) before anything is written — nothing is
    saved until you confirm.
  - **Install offer** after saving, running `npm` / `yarn` / `pnpm install` in the
    AngularPad terminal based on your settings.
  - Indentation (spaces/tabs), key order and trailing newline of each
    `package.json` are preserved for minimal, git-friendly diffs.
- **Close (✕) button** in the top-right corner of the Settings modal.

## [0.3.1] - 2026-04-02

### Fixed

- Minor fixes and packaging adjustments.

## [0.3.0] - 2026-04-02

### Added

- Custom commands with global or project-local (per-workspace) scope.
- Workspace tab: scan all `package.json` files and import their scripts.
- Nx workspace detection with automatic project selection for targets.
- Package manager integration (npm, yarn, pnpm).
- Multi-language support (English / German).

### Changed

- Split the extension into modular files and moved the UI to a webview panel.

## [0.2.0] - 2026-04-02

### Added

- Predefined Angular, lint/format and package-manager commands.
- Updated extension icon.

## [0.1.0] - 2026-04-02

### Added

- Initial release: command launchpad panel with one-click Angular commands
  running in a dedicated AngularPad terminal.

[0.7.0]: https://github.com/GrischaTDev/angularpad
[0.3.1]: https://github.com/GrischaTDev/angularpad
[0.3.0]: https://github.com/GrischaTDev/angularpad
[0.2.0]: https://github.com/GrischaTDev/angularpad
[0.1.0]: https://github.com/GrischaTDev/angularpad
