import * as vscode from "vscode";
import sceneEditorHTML from "./sceneEditor.html";
import {
  createSceneMessageHandler,
  type SceneWebviewMessage,
} from "./sceneMessageHandler";

export interface SceneData {
  [key: string]: unknown;
}

function isMergeable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Apply a JSON patch object; null at a key means delete that key. */
function applyScenePatch(scene: SceneData, patch: SceneData): void {
  for (const key of Object.keys(patch)) {
    const patchValue = patch[key];
    if (patchValue === null) {
      delete scene[key];
    } else if (isMergeable(patchValue)) {
      const existing = scene[key];
      if (existing !== undefined && isMergeable(existing)) {
        applyScenePatch(existing, patchValue);
      } else {
        const created: SceneData = {};
        scene[key] = created;
        applyScenePatch(created, patchValue);
      }
    } else {
      scene[key] = patchValue;
    }
  }
}

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

  constructor(private readonly extensionUri: vscode.Uri) {}

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
    const html = this.getHtmlForWebview(webview);
    webview.html = html;

    const handleMessage = createSceneMessageHandler({
      document,
      fireEdit: (event) => this._onDidChangeCustomDocument.fire(event),
      applyScenePatch,
      notifyWebviews: () => document.notifyWebviews(),
    });
    
    webview.onDidReceiveMessage((message: { type: string }) => {
      if (message.type === "requestInitialScene") {
        webview.postMessage({
          type: "update",
          content: JSON.stringify(document.getData(), null, 2),
        });
        return;
      }
      handleMessage(message as SceneWebviewMessage);
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

  private getHtmlForWebview(_webview: vscode.Webview): string {
    const port = parseInt(process.env.GAMEIDE_RUNTIME_PORT ?? "38472", 10) || 38472;
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
