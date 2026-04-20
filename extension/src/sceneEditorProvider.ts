import * as vscode from "vscode";
import {
  applyScenePatch,
  buildScenePatchFromDiff,
  createSceneChannel,
  SCENE_CHANNEL,
  type SceneChannelInMessage,
  type SceneChannelTransport,
  type SceneData,
  type ScenePatch,
} from "gameide";
import type { ViteDevServer } from "./viteDevServer";
import sceneEditorHTML from "./sceneEditor.html?raw";

const UNDOABLE_MESSAGE_TYPES = new Set<string>([SCENE_CHANNEL.scenePatch]);

export type { SceneData, ScenePatch };

export class SceneDocument implements vscode.CustomDocument {
  private scene: SceneData;
  private savedData: SceneData;
  private broadcastHandler: ((content: string) => void) | undefined;
  private readonly onDispose: ((doc: SceneDocument) => void) | undefined;

  constructor(
    public readonly uri: vscode.Uri,
    initialData: SceneData,
    onDispose?: (doc: SceneDocument) => void,
  ) {
    this.scene = JSON.parse(JSON.stringify(initialData));
    this.savedData = JSON.parse(JSON.stringify(initialData));
    this.onDispose = onDispose;
  }

  getData(): SceneData {
    return { ...this.scene };
  }

  getDocumentData(): SceneData {
    return { ...this.scene };
  }

  getSavedData(): SceneData {
    return { ...this.savedData };
  }

  getSceneRoot(): SceneData {
    return this.scene;
  }

  getPatchFromSavedToCurrent(): ScenePatch {
    return buildScenePatchFromDiff(
      this.savedData as Record<string, unknown>,
      this.scene as Record<string, unknown>,
    );
  }

  markSaved(): void {
    this.savedData = JSON.parse(JSON.stringify(this.scene));
  }

  setData(data: SceneData): void {
    const patch = buildScenePatchFromDiff(
      this.scene as Record<string, unknown>,
      data as Record<string, unknown>,
    );
    applyScenePatch(this.scene, patch);
    this.broadcastScene();
  }

  setBroadcastScene(handler: ((content: string) => void) | undefined): void {
    this.broadcastHandler = handler;
  }

  broadcastScene(): void {
    this.broadcastHandler?.(JSON.stringify(this.scene, null, 2));
  }

  applyPatch(patch: ScenePatch): void {
    applyScenePatch(this.scene, patch);
  }

  mergeSceneFromRuntime(data: SceneData): void {
    const patch = buildScenePatchFromDiff(
      this.scene as Record<string, unknown>,
      data as Record<string, unknown>,
    );
    applyScenePatch(this.scene, patch);
  }

  revertData(data: SceneData): void {
    const snapshot = JSON.parse(JSON.stringify(data)) as SceneData;
    this.scene = snapshot;
    this.savedData = JSON.parse(JSON.stringify(snapshot));
    this.broadcastScene();
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
    let data: SceneData = {};
    if (openContext.backupId) {
      try {
        const backupUri = vscode.Uri.parse(openContext.backupId);
        const bytes = await vscode.workspace.fs.readFile(backupUri);
        data = JSON.parse(Buffer.from(bytes).toString("utf8")) as SceneData;
      } catch {
        data = {};
      }
    } else if (openContext.untitledDocumentData) {
      try {
        data = JSON.parse(
          Buffer.from(openContext.untitledDocumentData).toString("utf8"),
        ) as SceneData;
      } catch {
        data = {};
      }
    } else {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        data = JSON.parse(Buffer.from(bytes).toString("utf8")) as SceneData;
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
    document.setBroadcastScene((content) => {
      webviewPanel.webview.postMessage({ type: "scene", content });
    });
    webviewPanel.onDidDispose(() => {
      document.setBroadcastScene(undefined);
      this.webviewToDocument.delete(webviewPanel.webview);
    });
    this.webviewToDocument.set(webviewPanel.webview, document);
    webviewPanel.onDidChangeViewState(() => {});
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    const html = this.getHTMLForWebview(webview);
    webview.html = html;

    const transport: SceneChannelTransport = {
      send: (message: unknown): void => {
        const castMessage = message as { type: string; content?: string };
        if (typeof castMessage.content !== "undefined") {
          webview.postMessage({
            type: "scene",
            content: castMessage.content,
          });
        }
      },
      onMessage: (
        handler: (message: SceneChannelInMessage) => void
      ): () => void => {
        const disposable = webview.onDidReceiveMessage((raw: unknown) => {
          const message = raw as {
            type: string;
            content?: string;
            patch?: ScenePatch;
          };
          const isUndoable = UNDOABLE_MESSAGE_TYPES.has(message.type);
          let previous: SceneData | null = null;
          if (isUndoable) {
            previous = JSON.parse(JSON.stringify(document.getData()));
          }
          handler(message as SceneChannelInMessage);
          if (isUndoable && previous) {
            const next = JSON.parse(JSON.stringify(document.getData()));
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


    await createSceneChannel({
      transport,
      getScene: () => document.getSceneRoot(),
      setScene: (data: SceneData) => document.mergeSceneFromRuntime(data),
      applyPatch: (_scene: SceneData, patch: ScenePatch) =>
        document.applyPatch(patch),
      getInitialSceneContent: () =>
        JSON.stringify(document.getDocumentData(), null, 2),
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
    data: SceneData,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    if (cancellation.isCancellationRequested) return;
    const bytes = Buffer.from(JSON.stringify(data, null, 2), "utf8");
    await vscode.workspace.fs.writeFile(uri, bytes);
  }

  private getHTMLForWebview(webview: vscode.Webview): string {
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
