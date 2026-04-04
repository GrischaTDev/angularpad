import * as vscode from "vscode";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { Command } from "./types";

export async function getLocalCommands(): Promise<Command[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const configPath = path.join(rootPath, ".vscode", "angularpad.json");

  try {
    const content = await fsp.readFile(configPath, "utf8");
    const config = JSON.parse(content);
    return config.customCommands || [];
  } catch {
    return [];
  }
}

export async function saveLocalCommands(commands: Command[]): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const vscodeDir = path.join(rootPath, ".vscode");
  const configPath = path.join(vscodeDir, "angularpad.json");
  const gitignorePath = path.join(rootPath, ".gitignore");

  try {
    await fsp.mkdir(vscodeDir, { recursive: true });

    const localCommands = commands.filter((cmd) => cmd.scope === "local");
    await fsp.writeFile(
      configPath,
      JSON.stringify({ customCommands: localCommands }, null, 2),
      "utf8",
    );

    try {
      const gitignoreContent = await fsp.readFile(gitignorePath, "utf8");
      const angularpadEntry = ".vscode/angularpad.json";

      if (!gitignoreContent.includes(angularpadEntry)) {
        const updatedContent =
          gitignoreContent.trim() +
          "\n\n# Local AngularPad commands (project-specific)\n" +
          angularpadEntry +
          "\n";
        await fsp.writeFile(gitignorePath, updatedContent, "utf8");
      }
    } catch {
      // .gitignore doesn't exist - skip
    }
  } catch (e) {
    console.error("Error saving local commands:", e);
  }
}
