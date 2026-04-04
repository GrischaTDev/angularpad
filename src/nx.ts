import * as vscode from "vscode";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

export async function getProjectRoot(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const files = await vscode.workspace.findFiles(
    "**/package.json",
    "**/node_modules/**",
  );

  if (files.length === 0) {
    return rootPath;
  }

  files.sort((a, b) => a.fsPath.length - b.fsPath.length);
  return path.dirname(files[0].fsPath);
}

export async function getNxProjects(): Promise<string[]> {
  const projects = new Set<string>();

  const projectJsons = await vscode.workspace.findFiles(
    "**/project.json",
    "**/node_modules/**",
  );
  for (const file of projectJsons) {
    try {
      const content = await fsp.readFile(file.fsPath, "utf8");
      const json = JSON.parse(content);
      if (json.name) projects.add(json.name);
    } catch {
      // Skip invalid files
    }
  }

  const workspaceJsons = await vscode.workspace.findFiles(
    "{angular.json,workspace.json}",
    "**/node_modules/**",
  );
  for (const file of workspaceJsons) {
    try {
      const content = await fsp.readFile(file.fsPath, "utf8");
      const json = JSON.parse(content);
      if (json.projects) {
        Object.keys(json.projects).forEach((p) => projects.add(p));
      }
    } catch {
      // Skip invalid files
    }
  }

  return Array.from(projects).sort();
}

export async function getPackageJsonScripts(
  pm: string,
): Promise<{ label: string; command: string; color: string; icon: string }[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const files = await vscode.workspace.findFiles(
    "**/package.json",
    "**/node_modules/**",
  );
  const allScripts: {
    label: string;
    command: string;
    color: string;
    icon: string;
  }[] = [];

  const isNxWorkspace = await vscode.workspace
    .findFiles("{nx.json,workspace.json}", "**/node_modules/**", 1)
    .then((f) => f.length > 0);

  for (const file of files) {
    try {
      const fileContent = await fsp.readFile(file.fsPath, "utf8");
      const packageJson = JSON.parse(fileContent);
      const scripts = packageJson.scripts || {};

      if (Object.keys(scripts).length === 0) continue;

      const relPath = path.relative(rootPath, path.dirname(file.fsPath));
      const folderLabel = relPath === "" ? "root" : relPath;
      const absPath = path.dirname(file.fsPath);

      for (const scriptName of Object.keys(scripts)) {
        let finalCommand = `${pm} run ${scriptName}`;

        const nxTargets = ["serve", "build", "test", "lint", "e2e"];
        const isNxTargetScript =
          isNxWorkspace && nxTargets.includes(scriptName.split(":")[0]);

        if (isNxTargetScript) {
          finalCommand = `${pm} run ${scriptName}`;
        } else if (isNxWorkspace) {
          finalCommand = `${pm} run ${scriptName}`;
        } else if (relPath !== "") {
          if (pm === "yarn") {
            finalCommand = `yarn --cwd "${absPath}" run ${scriptName}`;
          } else if (pm === "pnpm") {
            finalCommand = `pnpm --dir "${absPath}" run ${scriptName}`;
          } else {
            finalCommand = `npm run ${scriptName} --prefix "${absPath}"`;
          }
        }

        allScripts.push({
          label: `[${folderLabel}] ${scriptName}`,
          command: finalCommand,
          color: "#3b82f6",
          icon: "📦",
        });
      }
    } catch (error) {
      console.error(`Fehler beim Lesen von ${file.fsPath}`, error);
    }
  }

  return allScripts.sort((a, b) => a.label.localeCompare(b.label));
}
