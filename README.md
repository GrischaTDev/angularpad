# AngularPad

A VS Code extension that provides a command launchpad for Angular, Nx, and Node.js projects. Run build, lint, test, and custom commands with a single click.

## Features

- **Predefined Commands** for Angular, Nx, linting, formatting, and package management
- **Custom Commands** with persistent storage (global or project-specific)
- **Workspace Scanning** to discover and import scripts from package.json files
- **Nx Workspace Support** with automatic project selection for targets
- **Package Manager Integration** (npm, yarn, pnpm) with proper command execution
- All commands run in a dedicated **AngularPad Terminal**
- Commands with input prompts (e.g., `ng generate component`) show input boxes
- **Multi-language Support** (English/German)

## Predefined Commands

### Angular
| Label | Command |
|---|---|
| Serve | `ng serve` |
| Build | `ng build` |
| Build Prod | `ng build --configuration production` |
| Test | `ng test` |
| E2E | `ng e2e` |
| Generate Component | `ng generate component <name>` |
| Generate Service | `ng generate service <name>` |

### Lint & Format
| Label | Command |
|---|---|
| Lint | `ng lint` |
| Lint --fix | `ng lint --fix` |
| Prettier | `npx prettier --write .` |

### Package Manager
| Label | Command |
|---|---|
| npm install | `npm install` |
| npm update | `npm update` |
| npm audit | `npm audit` |

## Nx Workspace Support

AngularPad automatically detects Nx workspaces and provides enhanced functionality:

- **Project Selection**: For Nx targets (build, lint, test, etc.), automatically prompts to select the target project
- **Workspace Root Execution**: Commands run from the correct workspace root directory
- **Script Discovery**: Scans all package.json files and imports scripts with proper Nx integration

## Custom Commands

Add your own commands through the **"Add Command"** form with custom labels, icons, colors, and working directories. Commands can be stored globally (available in all workspaces) or locally (project-specific, automatically added to .gitignore).

### Command Properties
- **Label**: Display name for the command
- **Command**: The actual command to execute
- **Icon**: Emoji icon (optional)
- **Color**: Visual category (Blue, Red, Yellow, Green, Purple)
- **Working Directory**: Custom execution directory (optional)
- **Scope**: Global or Local storage

## Workspace Scanning

The "Workspace" tab scans all package.json files in your project and imports available scripts. For Nx workspaces, scripts are executed from the workspace root with proper project resolution.

## Settings

Configure AngularPad through the settings modal (⚙️ button):

- **Language**: English / German
- **Workspace CLI**: Angular CLI or Nx
- **Package Manager**: npm, yarn, or pnpm

## Installation

### From VS Code Marketplace
Search for "AngularPad" in the VS Code Extensions marketplace.

### Development Installation
```bash
git clone https://github.com/GrischaTDev/angularpad
cd angularpad
npm install
npm run compile
```

Then in VS Code: `F5` → Launch Extension Development Host.

## Usage

1. Open the AngularPad panel from the activity bar (lightning bolt icon)
2. Click any predefined command to execute it
3. Use "Add Command" to create custom commands
4. Use "Scan Scripts" in the Workspace tab to import project scripts
5. Configure settings via the ⚙️ button

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - see LICENSE file for details.

## Pakete installieren & VSIX bauen

```bash
npm install -g @vscode/vsce
vsce package
```
