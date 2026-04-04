import * as vscode from "vscode";
import { NgCommanderViewProvider } from "./provider";
import { handleCommand } from "./commands";

export function activate(context: vscode.ExtensionContext) {
  const provider = new NgCommanderViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("angularpad.panel", provider),
    vscode.commands.registerCommand("angularpad.openPanel", () => {
      vscode.commands.executeCommand("angularpad.panel.focus");
    }),
    vscode.commands.registerCommand("angularpad.runCommand", (cmd: string) => {
      handleCommand(cmd, context);
    }),
  );
}

export function deactivate() {}
