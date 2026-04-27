import * as vscode from "vscode";
import type { SceneData } from "gameide";
import { ViteDevServer, resolveRuntimeDir } from "./viteDevServer";
import { SceneEditorProvider } from "./sceneEditorProvider";
import {
  deleteAssetDeclaration,
  deleteSceneDeclaration,
  syncAllAssetsDeclarations,
  syncAllSceneDeclarations,
  syncAssetDeclaration,
  syncSceneDeclaration,
} from "./sceneTypeDeclarations";
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
  const assetWatchers: vscode.FileSystemWatcher[] = [];
  const assetPendingUri = new Map<string, ReturnType<typeof setTimeout>>();

  await syncAllSceneDeclarations();
  await syncAllAssetsDeclarations();

  async function syncSceneFromDisk(uri: vscode.Uri): Promise<void> {
    try {
      await syncSceneDeclaration(uri);
    } catch {
    }

    const doc = sceneEditorProvider.getDocumentByUri(uri);
    if (!doc) return;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const newData = JSON.parse(Buffer.from(bytes).toString("utf8")) as SceneData;
      doc.revertData(newData);
    } catch {
    }
  }

  function scheduleSync(uri: vscode.Uri): void {
    const key = uri.toString();
    const existing = pendingUri.get(key);
    if (existing) clearTimeout(existing);
    pendingUri.set(
      key,
      setTimeout(() => {
        pendingUri.delete(key);
        syncSceneFromDisk(uri);
      }, SCENE_FILE_DEBOUNCE_MS)
    );
  }

  function scheduleAssetSync(uri: vscode.Uri): void {
    const key = uri.toString();
    const existing = assetPendingUri.get(key);
    if (existing) clearTimeout(existing);
    assetPendingUri.set(
      key,
      setTimeout(() => {
        assetPendingUri.delete(key);
        void syncAssetDeclaration(uri);
      }, SCENE_FILE_DEBOUNCE_MS)
    );
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const w = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, "assets/**")
    );
    assetWatchers.push(w);
  }

  context.subscriptions.push(
    sceneWatcher.onDidChange((uri) => scheduleSync(uri)),
    sceneWatcher.onDidCreate((uri) => scheduleSync(uri)),
    sceneWatcher.onDidDelete((uri) => {
      const key = uri.toString();
      const pending = pendingUri.get(key);
      if (pending) clearTimeout(pending);
      pendingUri.delete(key);
      void deleteSceneDeclaration(uri);
    }),
    sceneWatcher,
    { dispose: () => pendingUri.forEach((t) => clearTimeout(t)) }
  );

  for (const w of assetWatchers) {
    context.subscriptions.push(
      w.onDidChange((uri) => scheduleAssetSync(uri)),
      w.onDidCreate((uri) => scheduleAssetSync(uri)),
      w.onDidDelete((uri) => {
        const key = uri.toString();
        const pending = assetPendingUri.get(key);
        if (pending) clearTimeout(pending);
        assetPendingUri.delete(key);
        void deleteAssetDeclaration(uri);
      }),
      w
    );
  }
  context.subscriptions.push({
    dispose: () => assetPendingUri.forEach((t) => clearTimeout(t)),
  });

  registerUploadGameCommand(context);
}

export function deactivate(): void {}
