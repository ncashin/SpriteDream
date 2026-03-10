import * as vscode from "vscode";
import {
  applyScenePatch,
  buildPatchFromDiff,
  createSceneChannel,
  SCENE_CHANNEL,
  SCENE_MESSAGE_TYPES,
  type SceneChannelInMessage,
  type SceneChannelTransport,
  type SceneData,
  type ScenePatch,
} from "gameide";

const UNDOABLE_MESSAGE_TYPES = new Set<string>([
  SCENE_CHANNEL.initialScene,
  SCENE_CHANNEL.scenePatch,
]);
import type { ViteDevServer } from "./devServer";
import type { SceneDocumentRegistry } from "./sceneDocumentRegistry";
import sceneEditorHTML from "./sceneEditor.html?raw";

export type { SceneData, ScenePatch };

export class SceneDocument implements vscode.CustomDocument {
  private _data: SceneData;
  private _documentData: SceneData;
  private _savedData: SceneData;
  private _webviewPanels: Set<vscode.WebviewPanel> = new Set();
  private readonly _registry: SceneDocumentRegistry | undefined;

  constructor(
    public readonly uri: vscode.Uri,
    data: SceneData,
    registry?: SceneDocumentRegistry,
  ) {
    this._data = JSON.parse(JSON.stringify(data));
    this._documentData = JSON.parse(JSON.stringify(data));
    this._savedData = JSON.parse(JSON.stringify(data));
    this._registry = registry;
  }

  getData(): SceneData {
    return { ...this._data };
  }

  getDocumentData(): SceneData {
    return { ...this._documentData };
  }

  getSavedData(): SceneData {
    return { ...this._savedData };
  }

  getPatchFromSavedToCurrent(): ScenePatch {
    return buildPatchFromDiff(
      this._savedData as Record<string, unknown>,
      this._data as Record<string, unknown>,
    );
  }

  markSaved(): void {
    this._savedData = JSON.parse(JSON.stringify(this._documentData));
  }

  setData(data: SceneData): void {
    this._data = data;
    this._documentData = JSON.parse(JSON.stringify(data));
    this._registry?.notifyDocumentChanged(this);
    this.broadcastScene();
  }

  addWebviewPanel(panel: vscode.WebviewPanel): void {
    this._webviewPanels.add(panel);
    panel.onDidDispose(() => this._webviewPanels.delete(panel));
  }

  /** Push current scene to all consumers (editor panels, then sidebar via registry). */
  broadcastScene(): void {
    const content = JSON.stringify(this._data, null, 2);
    for (const panel of this._webviewPanels) {
      if (panel.webview) {
        panel.webview.postMessage({ type: "scene", content });
      }
    }
  }

  applyPatch(patch: ScenePatch): void {
    applyScenePatch(this._data, patch);
    applyScenePatch(this._documentData, patch);
    this._registry?.notifyDocumentChanged(this);
    this.broadcastScene();
  }

  revertData(data: SceneData): void {
    this._data = JSON.parse(JSON.stringify(data));
    this._documentData = JSON.parse(JSON.stringify(data));
    this._savedData = JSON.parse(JSON.stringify(data));
    this._registry?.notifyDocumentChanged(this);
    this.broadcastScene();
  }

  dispose(): void {
    this._webviewPanels.clear();
    this._registry?.remove(this);
  }
}

export class SceneEditorProvider implements vscode.CustomEditorProvider<SceneDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<SceneDocument>
  >();
  private readonly _webviewToDocument = new Map<
    vscode.Webview,
    SceneDocument
  >();

  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly devServer: ViteDevServer | null = null,
    private readonly documentRegistry?: SceneDocumentRegistry,
  ) {
    documentRegistry?.onDocumentEdit((e) => {
      const sceneDoc = e.document as SceneDocument;
      const previous = JSON.parse(JSON.stringify(e.previous)) as SceneData;
      const next = JSON.parse(JSON.stringify(e.next)) as SceneData;
      this._onDidChangeCustomDocument.fire({
        document: sceneDoc,
        label: "Edit",
        undo: async () => sceneDoc.setData(previous),
        redo: async () => sceneDoc.setData(next),
      });
    });
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
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
    const document = new SceneDocument(uri, data, this.documentRegistry);
    this.documentRegistry?.add(document);
    return document;
  }

  async resolveCustomEditor(
    document: SceneDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    document.addWebviewPanel(webviewPanel);
    this._webviewToDocument.set(webviewPanel.webview, document);
    webviewPanel.onDidDispose(() =>
      this._webviewToDocument.delete(webviewPanel.webview),
    );
    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) {
        this.documentRegistry?.setActiveDocument(document);
      }
    });
    if (webviewPanel.visible) {
      this.documentRegistry?.setActiveDocument(document);
    }
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    const html = this.getHTMLForWebview(webview);
    webview.html = html;

    const transport: SceneChannelTransport = {
      send: (m: unknown) => {
        const msg = m as { type: string; content?: string };
        if (msg.content !== undefined) {
          webview.postMessage({ type: "scene", content: msg.content });
        }
      },
      onMessage: (handler: (m: SceneChannelInMessage) => void) => {
        webview.onDidReceiveMessage((raw: unknown) => {
          const message = raw as {
            type: string;
            content?: string;
            patch?: ScenePatch;
          };
          const undoable = UNDOABLE_MESSAGE_TYPES.has(message.type);
          const previous = undoable
            ? JSON.parse(JSON.stringify(document.getData()))
            : null;
          handler(message as SceneChannelInMessage);
          if ((SCENE_MESSAGE_TYPES as Set<string>).has(message.type)) {
            this.documentRegistry?.notifyDocumentChanged(document);
          }
          if (undoable && previous) {
            const next = JSON.parse(JSON.stringify(document.getData()));
            this._onDidChangeCustomDocument.fire({
              document,
              label: "Edit",
              undo: async () => document.setData(previous),
              redo: async () => document.setData(next),
            });
          }
        });
        return () => {};
      },
    };

    createSceneChannel({
      transport,
      getSceneData: () => document.getData(),
      setSceneData: (data: SceneData) => document.setData(data),
      applyScenePatch,
      onRequestInitial: () =>
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
    _cancellation: vscode.CancellationToken,
  ): Promise<void> {
    const bytes = await vscode.workspace.fs.readFile(document.uri);
    const data = JSON.parse(Buffer.from(bytes).toString("utf8")) as SceneData;
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
        } catch {
          // Ignore
        }
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

  private getHTMLForWebview(_webview: vscode.Webview): string {
    const port = this.devServer
      ? this.devServer.getPort()
      : parseInt(process.env.GAMEIDE_RUNTIME_PORT ?? "38472", 10) || 38472;
    const csp = [
      "default-src 'none'",
      `frame-src http://localhost:${port}`,
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
    ].join("; ");
    return sceneEditorHTML
      .replace("{{CSP}}", csp)
      .replace("{{PORT}}", String(port));
  }
}
