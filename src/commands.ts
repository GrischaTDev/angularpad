import * as vscode from "vscode";
import { Command } from "./types";
import { getNxProjects, getProjectRoot } from "./nx";

export const DEFAULT_COMMANDS: Command[] = [
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

function getTerminalName(command: string): string {
  if (command.includes("serve")) return "AngularPad: Serve";
  if (command.includes("test")) return "AngularPad: Test";
  if (command.includes("e2e")) return "AngularPad: E2E";
  if (command.includes("lint") || command.includes("run-many"))
    return "AngularPad: Lint";
  return "AngularPad";
}

export async function runInTerminal(
  command: string,
  customCwd?: string,
) {
  const cwd = customCwd || (await getProjectRoot());

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

export async function handleCommand(
  command: string,
  context: vscode.ExtensionContext,
  cwd?: string,
) {
  const pm = context.globalState.get<string>("packageManager") || "npm";
  let finalCommand = command;

  const scriptMatch = command.match(/(?:run|script)\s+([a-z0-9:_-]+)/i);
  const scriptName = scriptMatch?.[1];

  const nxTargets = ["serve", "build", "test", "lint", "e2e"];

  const isExplicitNxTarget =
    /\b(nx|ng)\s+(serve|build|test|lint|e2e)(?:\s|-|$)/.test(command);

  const isNxTargetScript =
    scriptName && nxTargets.includes(scriptName.split(":")[0]);

  if (isExplicitNxTarget || isNxTargetScript) {
    const projects = await getNxProjects();

    if (projects.length > 0) {
      let selected: string | undefined;

      if (projects.length === 1) {
        selected = projects[0];
      } else {
        const lang = context.globalState.get<string>("language") || "en";
        const placeHolder =
          lang === "de"
            ? "Wähle das Projekt (App/Lib) aus..."
            : "Select the project (App/Lib)...";

        selected = await vscode.window.showQuickPick(projects, {
          placeHolder,
        });
      }

      if (!selected) {
        return;
      }

      if (isExplicitNxTarget) {
        const targetMatch = finalCommand.match(
          /\b(nx|ng)\s+(serve|build|test|lint|e2e)/,
        );
        if (targetMatch) {
          const tool = targetMatch[1];
          const target = targetMatch[2];
          if (tool === "nx") {
            if (pm === "yarn") {
              finalCommand = `yarn nx ${target} ${selected}`;
            } else if (pm === "pnpm") {
              finalCommand = `pnpm nx ${target} ${selected}`;
            } else {
              finalCommand = `npx nx ${target} ${selected}`;
            }
          } else {
            finalCommand = `npx ng ${target} ${selected}`;
          }
        }
      } else if (isNxTargetScript) {
        const target = scriptName.split(":")[0];
        if (pm === "yarn") {
          finalCommand = `yarn nx ${target} ${selected}`;
        } else if (pm === "pnpm") {
          finalCommand = `pnpm nx ${target} ${selected}`;
        } else {
          finalCommand = `npx nx ${target} ${selected}`;
        }
      }
    }
  }

  runInTerminal(finalCommand, cwd);
}
