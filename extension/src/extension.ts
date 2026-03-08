import * as vscode from "vscode";
import { SceneEditorProvider } from "./sceneEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "gameide.scenePreview",
      new SceneEditorProvider(context.extensionUri),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    )
  );
}

export function deactivate(): void {}
