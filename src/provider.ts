import * as vscode from "vscode";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { Command } from "./types";
import { DEFAULT_COMMANDS, handleCommand } from "./commands";
import { getLocalCommands, saveLocalCommands } from "./local-commands";
import { getPackageJsonScripts } from "./nx";

export class NgCommanderViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    const extensionUri = this._context.extensionUri;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "src", "webview"),
        vscode.Uri.joinPath(extensionUri, "out", "webview"),
      ],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "run":
          handleCommand(msg.command, this._context, msg.cwd);
          break;
        case "runWithInput":
          vscode.window
            .showInputBox({ prompt: msg.prompt, placeHolder: msg.placeholder })
            .then((value) => {
              if (value !== undefined) {
                handleCommand(msg.command + value, this._context);
              }
            });
          break;
        case "saveCustomCommands": {
          const globalCmds = (msg.commands as Command[]).filter(
            (c) => c.scope !== "local",
          );
          const localCmds = (msg.commands as Command[]).filter(
            (c) => c.scope === "local",
          );
          await this._context.globalState.update("customCommands", globalCmds);
          await saveLocalCommands(localCmds);
          break;
        }
        case "getCustomCommands": {
          const globalCmds = this._context.globalState.get<Command[]>(
            "customCommands",
            [],
          );
          const localCmds = await getLocalCommands();
          const allCmds = [
            ...globalCmds.filter((c) => c.scope !== "local"),
            ...localCmds,
          ];
          webviewView.webview.postMessage({
            type: "customCommands",
            commands: allCmds,
          });
          break;
        }
        case "saveSettings": {
          this._context.globalState.update(
            "packageManager",
            msg.packageManager,
          );
          this._context.globalState.update("language", msg.language);
          this._context.globalState.update("cli", msg.cli);
          break;
        }
        case "getSettings": {
          vscode.workspace
            .findFiles("**/nx.json", "**/node_modules/**", 1)
            .then((nxFiles) => {
              const hasNx = nxFiles.length > 0;
              const pm =
                this._context.globalState.get<string>("packageManager");
              const lang = this._context.globalState.get<string>("language");
              const cli = this._context.globalState.get<string>("cli");

              webviewView.webview.postMessage({
                type: "initSettings",
                packageManager: pm,
                language: lang,
                cli: cli,
                hasNx: hasNx,
              });
            });
          break;
        }
        case "getProjectScripts": {
          const pm =
            this._context.globalState.get<string>("packageManager") || "npm";
          getPackageJsonScripts(pm).then((scripts) => {
            webviewView.webview.postMessage({
              type: "projectScripts",
              scripts: scripts,
            });
          });
          break;
        }
      }
    });
  }

  private _getHtml(webview: vscode.Webview): string {
    const webviewPath = path.join(
      this._context.extensionPath,
      "src",
      "webview",
    );

    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "src", "webview", "styles.css"),
    );
    const i18nUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "src", "webview", "i18n.js"),
    );
    const mainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "src", "webview", "main.js"),
    );

    const defaultCmds = JSON.stringify(DEFAULT_COMMANDS);
    const cspSource = webview.cspSource;

    const templatePath = path.join(webviewPath, "index.html");

    // Read template synchronously during HTML generation (called once on view resolve)
    const fs = require("node:fs") as typeof import("node:fs");
    let html = fs.readFileSync(templatePath, "utf8");

    html = html
      .replace(/\{\{cspSource\}\}/g, cspSource)
      .replace(/\{\{stylesUri\}\}/g, stylesUri.toString())
      .replace(/\{\{i18nUri\}\}/g, i18nUri.toString())
      .replace(/\{\{mainUri\}\}/g, mainUri.toString())
      .replace(/\{\{defaultCommands\}\}/g, defaultCmds);

    return html;
  }
}
