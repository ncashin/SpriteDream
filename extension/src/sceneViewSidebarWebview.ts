import * as vscode from "vscode";
import { applyScenePatch, pathToPatch } from "gameide";
import type { SceneData, ScenePatch } from "gameide";
import type { SceneDocumentRegistry } from "./sceneDocumentRegistry";
import sceneViewSidebarHTML from "./sceneViewSidebar.html?raw";
import { Box, ChevronRight, ChevronDown, Trash2, Plus } from "lucide";

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
  chevronRight: ${JSON.stringify(iconToSvg(ChevronRight, 12))},
  chevronDown: ${JSON.stringify(iconToSvg(ChevronDown, 12))},
  trash: ${JSON.stringify(iconToSvg(Trash2, 12))},
  plus: ${JSON.stringify(iconToSvg(Plus, 12))}
};
</script>`;

export class SceneViewSidebarWebviewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _registry: SceneDocumentRegistry
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._registry.setSceneViewSidebarWebview(webviewView.webview);
    webviewView.onDidDispose(() => this._registry.setSceneViewSidebarWebview(undefined));

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg: {
      type: string;
      uri?: string;
      path?: string[];
      value?: unknown;
      delete?: boolean;
      newKey?: string;
      key?: string;
    }) => {
      if (msg.type === "ready") {
        this._registry.notifySceneViewSidebar();
        return;
      }
      if (msg.type === "requestUpdate") {
        this._registry.notifySceneViewSidebar();
        return;
      }
      const doc =
        msg.uri !== undefined
          ? this._registry.getDocumentByUri(vscode.Uri.parse(msg.uri))
          : this._registry.getActiveDocument();
      if (!doc) return;
      if (msg.uri !== undefined && doc.uri.toString() !== msg.uri) return;

      if (msg.type === "edit" && msg.path !== undefined) {
        if (msg.delete) {
          const patch: ScenePatch = pathToPatch(msg.path, undefined, true);
          const previous = doc.getData();
          const updated = JSON.parse(JSON.stringify(previous)) as SceneData;
          applyScenePatch(updated, patch);
          doc.setData(updated);
          doc.notifyWebviews();
          this._registry.notifyDocumentEdited(doc, previous, updated);
          this._registry.notifySceneViewSidebar();
        } else if (msg.value !== undefined) {
          const previous = doc.getData();
          let updated: SceneData;
          if (msg.path.length === 0) {
            updated = JSON.parse(JSON.stringify(msg.value)) as SceneData;
          } else {
            const patch: ScenePatch = pathToPatch(msg.path, msg.value);
            updated = JSON.parse(JSON.stringify(previous)) as SceneData;
            applyScenePatch(updated, patch);
          }
          doc.setData(updated);
          doc.notifyWebviews();
          this._registry.notifyDocumentEdited(doc, previous, updated);
          this._registry.notifySceneViewSidebar();
        }
        return;
      }
      if (msg.type === "rename" && msg.uri !== undefined && msg.path !== undefined && msg.path.length > 0 && msg.newKey !== undefined) {
        const parentPath = msg.path.slice(0, -1);
        const oldKey = msg.path[msg.path.length - 1];
        if (oldKey === msg.newKey) return;
        const data = doc.getData() as Record<string, unknown>;
        const getAt = (obj: Record<string, unknown>, p: string[]) => {
          let cur: unknown = obj;
          for (const k of p) cur = (cur as Record<string, unknown>)?.[k];
          return cur;
        };
        const value = getAt(data, msg.path);
        const previous = doc.getData();
        const updated = JSON.parse(JSON.stringify(previous)) as SceneData;
        applyScenePatch(updated, pathToPatch([...parentPath, oldKey], undefined, true));
        applyScenePatch(updated, pathToPatch([...parentPath, msg.newKey], value));
        doc.setData(updated);
        doc.notifyWebviews();
        this._registry.notifyDocumentEdited(doc, previous, updated);
        this._registry.notifySceneViewSidebar();
        return;
      }
      if (msg.type === "addProperty" && msg.uri !== undefined && msg.key !== undefined) {
        const pathArr = Array.isArray(msg.path) ? msg.path : [];
        const patch: ScenePatch = pathToPatch([...pathArr, msg.key], msg.value !== undefined ? msg.value : null);
        const previous = doc.getData();
        const updated = JSON.parse(JSON.stringify(previous)) as SceneData;
        applyScenePatch(updated, patch);
        doc.setData(updated);
        doc.notifyWebviews();
        this._registry.notifyDocumentEdited(doc, previous, updated);
        this._registry.notifySceneViewSidebar();
        return;
      }
    });
  }

  private _getHtml(webview: vscode.Webview): string {
    return sceneViewSidebarHTML.replace("{{LUCIDE_ICONS_SCRIPT}}", LUCIDE_ICONS_SCRIPT);
  }
}
