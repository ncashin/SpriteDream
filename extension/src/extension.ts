import * as vscode from "vscode";
import { buildPatchFromDiff, type SceneData } from "gameide";
import { ViteDevServer, resolveRuntimeDir } from "./devServer";
import { SceneDocumentRegistry } from "./sceneDocumentRegistry";
import { SceneEditorProvider } from "./sceneEditorProvider";
import { SceneViewSidebarWebviewProvider } from "./sceneViewSidebarWebview";

const SCENE_FILE_DEBOUNCE_MS = 150;

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
      "gameide.sceneEditor",
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
      "gameide.sceneViewSidebar",
      new SceneViewSidebarWebviewProvider(context.extensionUri, sceneDocumentRegistry)
    )
  );

  const sceneWatcher = vscode.workspace.createFileSystemWatcher("**/*.scene");
  const pendingUri = new Map<string, ReturnType<typeof setTimeout>>();

  async function syncSceneFromDisk(uri: vscode.Uri): Promise<void> {
    const doc = sceneDocumentRegistry.getDocumentByUri(uri);
    if (!doc) return;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const newData = JSON.parse(Buffer.from(bytes).toString("utf8")) as SceneData;
      const lastFromDisk = doc.getDocumentData();
      const patch = buildPatchFromDiff(
        lastFromDisk as Record<string, unknown>,
        newData as Record<string, unknown>
      );
      doc.revertData(newData);
      if (Object.keys(patch).length > 0) {
        doc.notifyWebviewsPatch(patch);
      }
    } catch {
      // Ignore read/parse errors (e.g. invalid JSON while saving)
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

  context.subscriptions.push(
    sceneWatcher.onDidChange((uri) => scheduleSync(uri)),
    sceneWatcher,
    { dispose: () => pendingUri.forEach((t) => clearTimeout(t)) }
  );
}

export function deactivate(): void {}
