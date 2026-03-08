import * as path from "path";
import * as vscode from "vscode";
import { applyScenePatch, pathToPatch } from "gameide";
import type { SceneData } from "gameide";
import type { ISceneDocument, SceneDocumentRegistry } from "./sceneDocumentRegistry";
import sceneStateViewHTML from "./sceneStateView.html";

function getDocumentsPayload(registry: SceneDocumentRegistry): { name: string; uri: string; data: SceneData }[] {
  const doc = registry.getActiveDocument();
  if (!doc) return [];
  return [
    {
      name: path.basename(doc.uri.fsPath),
      uri: doc.uri.toString(),
      data: doc.getData(),
    },
  ];
}

export class SceneStateWebviewProvider implements vscode.WebviewViewProvider {
  private _view: vscode.WebviewView | undefined;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _registry: SceneDocumentRegistry
  ) {
    _registry.onDidChange(() => this._pushState());
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg: { type: string; uri?: string; path?: string[]; value?: unknown }) => {
      if (msg.type === "ready") {
        this._pushState();
        return;
      }
      if (msg.type === "edit" && msg.uri !== undefined && msg.path !== undefined && msg.value !== undefined) {
        const doc = this._registry.getActiveDocument();
        if (!doc || doc.uri.toString() !== msg.uri) return;
        const patch = pathToPatch(msg.path, msg.value);
        const previous = doc.getData();
        const updated = JSON.parse(JSON.stringify(previous)) as SceneData;
        applyScenePatch(updated, patch);
        doc.setData(updated);
        doc.notifyWebviews();
      }
    });
  }

  private _pushState(): void {
    if (this._view?.webview) {
      this._view.webview.postMessage({
        type: "update",
        documents: getDocumentsPayload(this._registry),
      });
    }
  }

  private _getHtml(webview: vscode.Webview): string {
    return sceneStateViewHTML;
  }
}
