import * as vscode from "vscode";
import { ViteDevServer, resolveRuntimeDir } from "./devServer";
import { SceneEditorProvider } from "./sceneEditorProvider";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const runtimeDir = resolveRuntimeDir(context.extensionUri);
  const devServer = runtimeDir
    ? new ViteDevServer({ runtimeDirectory: runtimeDir })
    : null;
  if (devServer) {
    context.subscriptions.push(devServer);
    await devServer.start();
  }
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "gameide.scenePreview",
      new SceneEditorProvider(context.extensionUri, devServer),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    )
  );
}

export function deactivate(): void {}
