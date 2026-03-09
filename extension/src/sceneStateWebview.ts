import * as path from "path";
import * as vscode from "vscode";
import { applyScenePatch, pathToPatch } from "gameide";
import type { SceneData, ScenePatch } from "gameide";
import type { SceneDocumentRegistry } from "./sceneDocumentRegistry";
import sceneStateViewHTML from "./sceneStateView.html?raw";
import { Box, ChevronRight, ChevronDown } from "lucide";

type IconNode = [tag: string, attrs: Record<string, string | number | undefined>][];

function iconToSvg(iconNode: IconNode, size: number): string {
  const attrs: Record<string, string | number> = {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  };
  const attrStr = (o: Record<string, string | number | undefined>) =>
    Object.entries(o)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`)
      .join(" ");
  const parts = iconNode.map(
    ([tag, a]) => `<${tag} ${attrStr(a)}/>`
  );
  return `<svg ${attrStr(attrs)}>${parts.join("")}</svg>`;
}

const LUCIDE_ICONS_SCRIPT = `<script>
window.LUCIDE_ICONS = {
  folder: ${JSON.stringify(iconToSvg(Box, 12))},
  chevronRight: ${JSON.stringify(iconToSvg(ChevronRight, 14))},
  chevronDown: ${JSON.stringify(iconToSvg(ChevronDown, 14))}
};
</script>`;

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
        const patch: ScenePatch = pathToPatch(msg.path, msg.value);
        const previous = doc.getData();
        const updated = JSON.parse(JSON.stringify(previous)) as SceneData;
        applyScenePatch(updated, patch);
        doc.setData(updated);
        doc.notifyWebviews();
        this._registry.notifyDocumentEdited(doc, previous, updated);
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
    return sceneStateViewHTML.replace("{{LUCIDE_ICONS_SCRIPT}}", LUCIDE_ICONS_SCRIPT);
  }
}
