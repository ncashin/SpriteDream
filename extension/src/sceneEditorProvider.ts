import * as vscode from "vscode";
import {
  curryScene,
  createSceneChannel,
  SCENE_CHANNEL,
  type Scene,
  type SceneChannelMessage,
  type SceneChannelTransport,
  type SceneObject,
} from "gameide";
import type { ViteDevServer } from "./viteDevServer";
import sceneEditorHTML from "./sceneEditor.html?raw";

function isInboundWebviewMessage(
  raw: unknown,
): raw is { type: string; content?: string } {
  if (raw === null || typeof raw !== "object") return false;
  const message = raw as Record<string, unknown>;
  return typeof message.type === "string";
}

const UNDOABLE_MESSAGE_TYPES = new Set<string>([SCENE_CHANNEL.scenePatch]);

export type { SceneObject };

export class SceneDocument implements vscode.CustomDocument {
  private rawScene: SceneObject;
  private savedData: SceneObject;
  private readonly sceneAPI: Scene;
  private broadcastHandler: ((content: string) => void) | undefined;
  private readonly onDispose: ((doc: SceneDocument) => void) | undefined;

  constructor(
    public readonly uri: vscode.Uri,
    initialData: SceneObject,
    onDispose?: (doc: SceneDocument) => void,
  ) {
    this.rawScene = structuredClone(initialData ?? {});
    this.savedData = structuredClone(initialData ?? {});
    this.sceneAPI = curryScene(this.rawScene);
    this.onDispose = onDispose;
  }

  getSceneAPI(): Scene {
    return this.sceneAPI;
  }

  getData(): SceneObject {
    return structuredClone(this.rawScene);
  }

  getDocumentData(): SceneObject {
    return structuredClone(this.rawScene);
  }

  getSavedData(): SceneObject {
    return structuredClone(this.savedData);
  }

  getSceneRoot(): SceneObject {
    return this.rawScene;
  }

  markSaved(): void {
    this.savedData = structuredClone(this.rawScene);
  }

  setData(data: SceneObject): void {
    this.replaceSceneWithSnapshot(data);
    this.broadcastScene();
  }

  setBroadcastScene(handler: ((content: string) => void) | undefined): void {
    this.broadcastHandler = handler;
  }

  broadcastScene(): void {
    this.broadcastHandler?.(JSON.stringify(this.rawScene, null, 2));
  }

  applyPatch(patch: SceneObject): void {
    this.sceneAPI.applyPatch(patch);
  }

  mergeSceneFromRuntime(data: SceneObject): void {
    this.replaceSceneWithSnapshot(data);
  }

  revertData(data: SceneObject): void {
    this.replaceSceneWithSnapshot(data);
    this.savedData = structuredClone(data);
    this.broadcastScene();
  }

  /** Clears and repopulates `rawScene` in place so `curryScene` stays bound. */
  private replaceSceneWithSnapshot(data: SceneObject): void {
    const snapshot = structuredClone(data ?? {});
    for (const key of Object.keys(this.rawScene)) {
      delete this.rawScene[key];
    }
    Object.assign(this.rawScene, snapshot);
  }

  dispose(): void {
    this.broadcastHandler = undefined;
    this.onDispose?.(this);
  }
}

export class SceneEditorProvider implements vscode.CustomEditorProvider<SceneDocument> {
  private readonly didChangeCustomDocumentEmitter = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<SceneDocument>
  >();
  private readonly webviewToDocument = new Map<
    vscode.Webview,
    SceneDocument
  >();
  private readonly documents = new Map<string, SceneDocument>();

  readonly onDidChangeCustomDocument = this.didChangeCustomDocumentEmitter.event;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly devServer: ViteDevServer | null = null,
  ) {}

  getDocumentByUri(uri: vscode.Uri): SceneDocument | undefined {
    return this.documents.get(uri.toString());
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken,
  ): Promise<SceneDocument> {
    let data: SceneObject = {};
    if (openContext.backupId) {
      try {
        const backupUri = vscode.Uri.parse(openContext.backupId);
        const bytes = await vscode.workspace.fs.readFile(backupUri);
        data = JSON.parse(Buffer.from(bytes).toString("utf8")) as SceneObject;
      } catch {
        data = {};
      }
    } else if (openContext.untitledDocumentData) {
      try {
        data = JSON.parse(
          Buffer.from(openContext.untitledDocumentData).toString("utf8"),
        ) as SceneObject;
      } catch {
        data = {};
      }
    } else {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        data = JSON.parse(Buffer.from(bytes).toString("utf8")) as SceneObject;
      } catch {
        data = {};
      }
    }
    const onDispose = (doc: SceneDocument) => {
      this.documents.delete(doc.uri.toString());
    };
    const document = new SceneDocument(uri, data, onDispose);
    this.documents.set(uri.toString(), document);
    return document;
  }

  async resolveCustomEditor(
    document: SceneDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken,
  ): Promise<void> {
    this.webviewToDocument.set(webviewPanel.webview, document);
    webviewPanel.onDidChangeViewState(() => {});
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    const transport: SceneChannelTransport = {
      send: (message: unknown): void => {
        webview.postMessage(message);
      },
      onMessage: (
        handler: (message: SceneChannelMessage) => void
      ): () => void => {
        const disposable = webview.onDidReceiveMessage((raw: unknown) => {
          if (!isInboundWebviewMessage(raw)) return;
          const message = raw;
          const isUndoable = UNDOABLE_MESSAGE_TYPES.has(message.type);
          let previous: SceneObject | null = null;
          if (isUndoable) {
            previous = document.getData();
          }
          handler(message as SceneChannelMessage);
          if (isUndoable && previous) {
            const next = document.getData();
            const actuallyChanged =
              JSON.stringify(previous) !== JSON.stringify(next);
            if (actuallyChanged) {
              this.didChangeCustomDocumentEmitter.fire({
                document,
                label: "Edit",
                undo: async () => document.setData(previous!),
                redo: async () => document.setData(next),
              });
            }
          }
        });
        return () => {
          disposable.dispose();
        };
      },
    };

    const channel = await createSceneChannel({
      transport,
      scene: document.getSceneAPI(),
      initializeScene: false,
    });
    document.setBroadcastScene((content) => {
      channel.sendSceneChange(content);
    });

    webview.html = this.getHTMLForWebview();

    webviewPanel.onDidDispose(() => {
      channel.dispose();
      document.setBroadcastScene(undefined);
      this.webviewToDocument.delete(webviewPanel.webview);
    });
  }

  async saveCustomDocument(
    document: SceneDocument,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await this.writeDocument(
      document.uri,
      document.getDocumentData(),
      cancellation,
    );
    document.markSaved();
  }

  async saveCustomDocumentAs(
    document: SceneDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await this.writeDocument(
      destination,
      document.getDocumentData(),
      cancellation,
    );
  }

  async revertCustomDocument(
    document: SceneDocument,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    const bytes = await vscode.workspace.fs.readFile(document.uri);
    const data = JSON.parse(Buffer.from(bytes).toString("utf8"));
    document.revertData(data);
  }

  async backupCustomDocument(
    document: SceneDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken,
  ): Promise<vscode.CustomDocumentBackup> {
    await this.writeDocument(
      context.destination,
      document.getDocumentData(),
      cancellation,
    );
    return {
      id: context.destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(context.destination);
        } catch {}
      },
    };
  }

  private async writeDocument(
    uri: vscode.Uri,
    data: SceneObject,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    if (cancellation.isCancellationRequested) return;
    const bytes = Buffer.from(JSON.stringify(data, null, 2), "utf8");
    await vscode.workspace.fs.writeFile(uri, bytes);
  }

  private getHTMLForWebview(): string {
    const port = this.devServer
      ? this.devServer.getPort()
      : parseInt(process.env.GAMEIDE_RUNTIME_PORT ?? "38472", 10) || 38472;

    const csp = [
      "default-src 'none'",
      `frame-src *`,
      `connect-src * stun: stuns: turn: turns:`,
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
    ].join("; ");
    return sceneEditorHTML
      .replace("{{CSP}}", csp)
      .replace("{{PORT}}", String(port));
  }
}
