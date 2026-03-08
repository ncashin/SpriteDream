import * as vscode from "vscode";
import {
  applyScenePatch,
  createSceneChannel,
  SCENE_CHANNEL,
  SCENE_MESSAGE_TYPES,
  type SceneChannelTransport,
  type SceneData,
} from "gameide";

const UNDOABLE_MESSAGE_TYPES = new Set<string>([
  SCENE_CHANNEL.initialScene,
  SCENE_CHANNEL.scenePatch,
]);
import type { ViteDevServer } from "./devServer";
import sceneEditorHTML from "./sceneEditor.html";

export type { SceneData };

export class SceneDocument implements vscode.CustomDocument {
  private _data: SceneData;
  private _webviewPanels: Set<vscode.WebviewPanel> = new Set();

  constructor(
    public readonly uri: vscode.Uri,
    data: SceneData
  ) {
    this._data = data;
  }

  getData(): SceneData {
    return { ...this._data };
  }

  setData(data: SceneData): void {
    this._data = data;
  }

  addWebviewPanel(panel: vscode.WebviewPanel): void {
    this._webviewPanels.add(panel);
    panel.onDidDispose(() => this._webviewPanels.delete(panel));
  }

  notifyWebviews(): void {
    const json = JSON.stringify(this._data, null, 2);
    for (const panel of this._webviewPanels) {
      if (panel.webview) {
        panel.webview.postMessage({ type: "update", content: json });
      }
    }
  }

  applyPatch(patch: SceneData): void {
    applyScenePatch(this._data, patch);
  }

  dispose(): void {
    this._webviewPanels.clear();
  }
}

export class SceneEditorProvider implements vscode.CustomEditorProvider<SceneDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<SceneDocument>
  >();

  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly devServer: ViteDevServer | null = null
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
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
          Buffer.from(openContext.untitledDocumentData).toString("utf8")
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
    return new SceneDocument(uri, data);
  }

  async resolveCustomEditor(
    document: SceneDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    document.addWebviewPanel(webviewPanel);
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
        if (
          msg.type === SCENE_CHANNEL.initialScene &&
          msg.content !== undefined
        ) {
          webview.postMessage({ type: "update", content: msg.content });
        } else {
          webview.postMessage(m);
        }
      },
      onMessage: (handler: (m: unknown) => void) => {
        webview.onDidReceiveMessage((message: { type: string }) => {
          const undoable = UNDOABLE_MESSAGE_TYPES.has(message.type);
          const previous = undoable ? document.getData() : null;
          handler(message);
          if ((SCENE_MESSAGE_TYPES as Set<string>).has(message.type)) {
            document.notifyWebviews();
          }
          if (undoable && previous) {
            const next = document.getData();
            this._onDidChangeCustomDocument.fire({
              document,
              label: "Edit",
              undo: async () => {
                document.setData(previous);
                document.notifyWebviews();
              },
              redo: async () => {
                document.setData(next);
                document.notifyWebviews();
              },
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
        JSON.stringify(document.getData(), null, 2),
    });
  }

  async saveCustomDocument(
    document: SceneDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    await this.writeDocument(document.uri, document.getData(), cancellation);
  }

  async saveCustomDocumentAs(
    document: SceneDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    await this.writeDocument(destination, document.getData(), cancellation);
  }

  async revertCustomDocument(
    document: SceneDocument,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    const bytes = await vscode.workspace.fs.readFile(document.uri);
    const data = JSON.parse(Buffer.from(bytes).toString("utf8")) as SceneData;
    document.setData(data);
    document.notifyWebviews();
  }

  async backupCustomDocument(
    document: SceneDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await this.writeDocument(context.destination, document.getData(), cancellation);
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
    cancellation: vscode.CancellationToken
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
