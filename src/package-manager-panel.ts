import * as vscode from "vscode";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import {
  AppliedChange,
  PackageFileInfo,
  VersionChange,
  applyVersionChanges,
  getWorkspaceDependencies,
} from "./packages";

const MAX_EXTERNAL_PACKAGE_BYTES = 2 * 1024 * 1024;

export interface PackageManagerTarget {
  type: "package" | "scope";
  value: string;
  version: string;
  absPath: string;
}

interface PackageManagerPanelDependencies {
  scan(): Promise<PackageFileInfo[]>;
  apply(changes: VersionChange[]): Promise<AppliedChange[]>;
  showOpenDialog(
    options: vscode.OpenDialogOptions,
  ): Thenable<readonly vscode.Uri[] | undefined>;
  readFile(filePath: string): Promise<string>;
  getFileSize(filePath: string): Promise<number>;
  showInformationMessage(message: string): Thenable<unknown>;
  showWarningMessage(message: string): Thenable<unknown>;
}

const defaultDependencies: PackageManagerPanelDependencies = {
  scan: getWorkspaceDependencies,
  apply: applyVersionChanges,
  showOpenDialog: (options) => vscode.window.showOpenDialog(options),
  readFile: (filePath) => fsp.readFile(filePath, "utf8"),
  getFileSize: async (filePath) => (await fsp.stat(filePath)).size,
  showInformationMessage: (message) =>
    vscode.window.showInformationMessage(message),
  showWarningMessage: (message) => vscode.window.showWarningMessage(message),
};

export class PackageManagerPanel {
  private panel?: vscode.WebviewPanel;
  private target?: PackageManagerTarget;
  private ready = false;
  private focusRevision = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onDependenciesChanged: (
      packages: PackageFileInfo[],
      applied?: AppliedChange[],
    ) => void,
    private readonly dependencies: PackageManagerPanelDependencies =
      defaultDependencies,
  ) {}

  async show(target: PackageManagerTarget): Promise<void> {
    this.target = target;
    this.focusRevision += 1;

    if (!this.panel) {
      this.createPanel();
    } else {
      this.panel.reveal(vscode.ViewColumn.Beside);
    }

    await this.postState();
  }

  private createPanel(): void {
    const webviewRoot = vscode.Uri.joinPath(
      this.context.extensionUri,
      "src",
      "webview",
    );

    this.panel = vscode.window.createWebviewPanel(
      "angularpad.packageManager",
      "AngularPad · Pakete",
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false,
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [webviewRoot],
      },
    );

    this.ready = false;
    this.panel.webview.html = this.getHtml(this.panel.webview);
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.ready = false;
    });
    this.panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== "object") return;
    const data = message as Record<string, unknown>;

    switch (data.type) {
      case "ready":
        this.ready = true;
        await this.postState();
        break;
      case "scan":
        await this.postState();
        break;
      case "applyVersionChanges":
        await this.applyChanges(data.changes);
        break;
      case "selectExternalPackageJson":
        await this.selectExternalPackageJson();
        break;
      case "close":
        this.panel?.dispose();
        break;
    }
  }

  private async postState(applied?: AppliedChange[]): Promise<void> {
    if (!this.panel || !this.ready) return;

    try {
      const packages = await this.dependencies.scan();
      const language = this.context.globalState.get<string>(
        "language",
        "en",
      );

      await this.panel.webview.postMessage({
        type: "state",
        packages,
        target: this.target,
        focusRevision: this.focusRevision,
        language,
      });
      this.onDependenciesChanged(packages, applied);
    } catch {
      await this.panel.webview.postMessage({
        type: "error",
        message: "Workspace-Pakete konnten nicht geladen werden.",
      });
    }
  }

  private async applyChanges(value: unknown): Promise<void> {
    const changes = this.parseChanges(value);
    if (changes.length === 0) return;

    const applied = await this.dependencies.apply(changes);
    const succeeded = applied.filter(
      (item) => item.ok && item.oldVersion !== item.newVersion,
    );
    const failed = applied.filter((item) => !item.ok);

    if (succeeded.length > 0) {
      await this.dependencies.showInformationMessage(
        `AngularPad: ${succeeded.length} Version(en) in package.json aktualisiert.`,
      );
    }
    if (failed.length > 0) {
      await this.dependencies.showWarningMessage(
        `AngularPad: ${failed.length} Änderung(en) konnten nicht angewendet werden.`,
      );
    }

    await this.postState(applied);
  }

  private parseChanges(value: unknown): VersionChange[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const change = item as Record<string, unknown>;
      if (
        typeof change.absPath !== "string" ||
        typeof change.name !== "string" ||
        typeof change.type !== "string" ||
        typeof change.newVersion !== "string" ||
        ![
          "dependencies",
          "devDependencies",
          "peerDependencies",
          "optionalDependencies",
        ].includes(change.type)
      ) {
        return [];
      }

      return [change as unknown as VersionChange];
    });
  }

  private async selectExternalPackageJson(): Promise<void> {
    const selected = await this.dependencies.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: "package.json vergleichen",
      filters: { JSON: ["json"] },
    });
    const file = selected?.[0];
    if (!file || !this.panel) return;

    try {
      const size = await this.dependencies.getFileSize(file.fsPath);
      if (size > MAX_EXTERNAL_PACKAGE_BYTES) {
        await this.dependencies.showWarningMessage(
          "AngularPad: Die Vergleichsdatei ist größer als 2 MB.",
        );
        return;
      }

      const content = await this.dependencies.readFile(file.fsPath);
      await this.panel.webview.postMessage({
        type: "externalPackageJson",
        source: file.fsPath,
        content,
      });
    } catch {
      await this.dependencies.showWarningMessage(
        "AngularPad: Die Vergleichsdatei konnte nicht gelesen werden.",
      );
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const webviewPath = path.join(
      this.context.extensionPath,
      "src",
      "webview",
    );
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "package-manager.css",
      ),
    );
    const i18nUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "i18n.js",
      ),
    );
    const modelUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "package-manager-model.js",
      ),
    );
    const mainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "package-manager.js",
      ),
    );
    const templatePath = path.join(webviewPath, "package-manager.html");
    const fs = require("node:fs") as typeof import("node:fs");

    return fs
      .readFileSync(templatePath, "utf8")
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{stylesUri\}\}/g, stylesUri.toString())
      .replace(/\{\{i18nUri\}\}/g, i18nUri.toString())
      .replace(/\{\{modelUri\}\}/g, modelUri.toString())
      .replace(/\{\{mainUri\}\}/g, mainUri.toString());
  }
}
