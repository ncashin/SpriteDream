import * as vscode from "vscode";
import { ViteDevServer, resolveRuntimeDir } from "./devServer";
import { SceneDocumentRegistry } from "./sceneDocumentRegistry";
import { SceneEditorProvider } from "./sceneEditorProvider";
import { SceneStateWebviewProvider } from "./sceneStateWebview";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const runtimeDir = resolveRuntimeDir(context.extensionUri);
  const devServer = runtimeDir
    ? new ViteDevServer({ runtimeDirectory: runtimeDir })
    : null;
  if (devServer) {
    context.subscriptions.push(devServer);
    await devServer.start();
  }

  const sceneDocumentRegistry = new SceneDocumentRegistry();
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "gameide.scenePreview",
      new SceneEditorProvider(
        context.extensionUri,
        devServer,
        sceneDocumentRegistry
      ),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    )
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "gameide.sceneState",
      new SceneStateWebviewProvider(context.extensionUri, sceneDocumentRegistry)
    )
  );
}

export function deactivate(): void {}
