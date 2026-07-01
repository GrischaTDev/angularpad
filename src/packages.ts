import * as vscode from "vscode";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

export type DepSection =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

const DEP_SECTIONS: DepSection[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

export interface DepEntry {
  name: string;
  version: string;
  type: DepSection;
}

export interface PackageFileInfo {
  /** Relative folder label, "root" for the workspace root. */
  folder: string;
  /** Absolute path to the package.json file. */
  absPath: string;
  /** The "name" field of the package.json, if present. */
  name?: string;
  deps: DepEntry[];
}

export interface VersionChange {
  absPath: string;
  name: string;
  type: DepSection;
  newVersion: string;
}

export interface AppliedChange {
  absPath: string;
  folder: string;
  name: string;
  type: DepSection;
  oldVersion: string;
  newVersion: string;
  ok: boolean;
  error?: string;
}

function folderLabel(absPath: string, rootPath: string): string {
  const relDir = path.relative(rootPath, path.dirname(absPath));
  return relDir === "" ? "root" : relDir.split(path.sep).join("/");
}

/** Detects the indentation used in a JSON file (tab or number of spaces). */
function detectIndent(content: string): string | number {
  const match = content.match(/\n([ \t]+)"/);
  if (match) {
    return match[1].includes("\t") ? "\t" : match[1].length;
  }
  return 2;
}

/**
 * Scans every package.json in the workspace (excluding node_modules) and
 * returns dependency information grouped per file / folder.
 */
export async function getWorkspaceDependencies(): Promise<PackageFileInfo[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const files = await vscode.workspace.findFiles(
    "**/package.json",
    "**/node_modules/**",
  );

  const result: PackageFileInfo[] = [];

  for (const file of files) {
    try {
      const content = await fsp.readFile(file.fsPath, "utf8");
      const json = JSON.parse(content);

      const deps: DepEntry[] = [];
      for (const section of DEP_SECTIONS) {
        const obj = json[section];
        if (obj && typeof obj === "object") {
          for (const [name, version] of Object.entries(obj)) {
            deps.push({ name, version: String(version), type: section });
          }
        }
      }

      if (deps.length === 0) {
        continue;
      }

      deps.sort((a, b) => a.name.localeCompare(b.name));

      result.push({
        folder: folderLabel(file.fsPath, rootPath),
        absPath: file.fsPath,
        name: typeof json.name === "string" ? json.name : undefined,
        deps,
      });
    } catch (error) {
      console.error(`AngularPad: failed to read ${file.fsPath}`, error);
    }
  }

  // Root first, then alphabetically by folder.
  result.sort((a, b) => {
    if (a.folder === "root") return -1;
    if (b.folder === "root") return 1;
    return a.folder.localeCompare(b.folder);
  });

  return result;
}

/**
 * Applies version changes to the given package.json files. Preserves the
 * detected indentation, key order and trailing newline. Returns the list of
 * changes that were actually applied (with old and new version).
 */
export async function applyVersionChanges(
  changes: VersionChange[],
): Promise<AppliedChange[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const rootPath = workspaceFolders?.[0]?.uri.fsPath ?? "";

  const byFile = new Map<string, VersionChange[]>();
  for (const change of changes) {
    const list = byFile.get(change.absPath);
    if (list) {
      list.push(change);
    } else {
      byFile.set(change.absPath, [change]);
    }
  }

  const applied: AppliedChange[] = [];

  for (const [absPath, fileChanges] of byFile) {
    const folder = folderLabel(absPath, rootPath);

    let content: string;
    try {
      content = await fsp.readFile(absPath, "utf8");
    } catch {
      for (const c of fileChanges) {
        applied.push({
          absPath,
          folder,
          name: c.name,
          type: c.type,
          oldVersion: "",
          newVersion: c.newVersion,
          ok: false,
          error: "read-failed",
        });
      }
      continue;
    }

    let json: any;
    try {
      json = JSON.parse(content);
    } catch {
      for (const c of fileChanges) {
        applied.push({
          absPath,
          folder,
          name: c.name,
          type: c.type,
          oldVersion: "",
          newVersion: c.newVersion,
          ok: false,
          error: "parse-failed",
        });
      }
      continue;
    }

    const indent = detectIndent(content);
    const trailingNewline = content.endsWith("\n");
    const perFile: AppliedChange[] = [];
    let changed = false;

    for (const c of fileChanges) {
      const section = json[c.type];
      if (
        section &&
        typeof section === "object" &&
        Object.prototype.hasOwnProperty.call(section, c.name)
      ) {
        const oldVersion = String(section[c.name]);
        if (oldVersion !== c.newVersion) {
          section[c.name] = c.newVersion;
          changed = true;
        }
        perFile.push({
          absPath,
          folder,
          name: c.name,
          type: c.type,
          oldVersion,
          newVersion: c.newVersion,
          ok: true,
        });
      } else {
        perFile.push({
          absPath,
          folder,
          name: c.name,
          type: c.type,
          oldVersion: "",
          newVersion: c.newVersion,
          ok: false,
          error: "not-found",
        });
      }
    }

    if (changed) {
      try {
        let out = JSON.stringify(json, null, indent);
        if (trailingNewline) {
          out += "\n";
        }
        await fsp.writeFile(absPath, out, "utf8");
      } catch {
        for (const a of perFile) {
          a.ok = false;
          a.error = "write-failed";
        }
      }
    }

    applied.push(...perFile);
  }

  return applied;
}
