import * as vscode from "vscode";
import type { SceneObject } from "gameide";
import { ViteDevServer, resolveRuntimeDir } from "./viteDevServer";
import { SceneEditorProvider } from "./sceneEditorProvider";
import { registerCreateGameCommand } from "./createGame";
import { registerUploadGameCommand } from "./uploadGame";

const SCENE_FILE_DEBOUNCE_MS = 150;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const runtimeDir = resolveRuntimeDir(context.extensionUri);
  let devServer: ViteDevServer | null = runtimeDir
    ? new ViteDevServer({ runtimeDirectory: runtimeDir })
    : null;
  if (devServer) {
    try {
      context.subscriptions.push(devServer);
      await devServer.start();
    } catch (err) {
      console.error(
        "[GameIDE] Failed to start vite dev server:",
        err instanceof Error ? err.message : err
      );
      devServer = null;
    }
  }

  const sceneEditorProvider = new SceneEditorProvider(
    context.extensionUri,
    devServer
  );
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "gameide.sceneEditor",
      sceneEditorProvider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    )
  );

  const sceneWatcher = vscode.workspace.createFileSystemWatcher("**/*.scene");
  const pendingUri = new Map<string, ReturnType<typeof setTimeout>>();

  async function reloadOpenSceneFromDisk(uri: vscode.Uri): Promise<void> {
    const doc = sceneEditorProvider.getDocumentByUri(uri);
    if (!doc) return;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const newData = JSON.parse(Buffer.from(bytes).toString("utf8")) as SceneObject;
      doc.revertData(newData);
    } catch {
    }
  }

  function scheduleSceneReload(uri: vscode.Uri): void {
    const key = uri.toString();
    const existing = pendingUri.get(key);
    if (existing) clearTimeout(existing);
    pendingUri.set(
      key,
      setTimeout(() => {
        pendingUri.delete(key);
        void reloadOpenSceneFromDisk(uri);
      }, SCENE_FILE_DEBOUNCE_MS)
    );
  }

  context.subscriptions.push(
    sceneWatcher.onDidChange((uri) => scheduleSceneReload(uri)),
    sceneWatcher.onDidCreate((uri) => scheduleSceneReload(uri)),
    sceneWatcher.onDidDelete((uri) => {
      const key = uri.toString();
      const pending = pendingUri.get(key);
      if (pending) clearTimeout(pending);
      pendingUri.delete(key);
    }),
    sceneWatcher,
    { dispose: () => pendingUri.forEach((t) => clearTimeout(t)) }
  );

  registerCreateGameCommand(context);
  registerUploadGameCommand(context);
}

export function deactivate(): void {}
