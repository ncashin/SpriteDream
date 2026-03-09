import * as path from "path";
import * as vscode from "vscode";
import type { SceneData, ScenePatch } from "gameide";

export interface ISceneDocument {
  readonly uri: vscode.Uri;
  getData(): SceneData;
  getDocumentData(): SceneData;
  getSavedData(): SceneData;
  getPatchFromSavedToCurrent(): ScenePatch;
  setData(data: SceneData): void;
  revertData(data: SceneData): void;
  notifyWebviews(): void;
  notifyWebviewsPatch(patch: ScenePatch): void;
}

export interface SceneDocumentEditEvent {
  document: ISceneDocument;
  previous: SceneData;
  next: SceneData;
}

export type SceneDocumentsPayload = { name: string; uri: string; data: SceneData }[];

export type ObjectDefinitionPayload = {
  name?: string;
  description?: string;
  schema: Record<string, string | number | boolean>;
};

export class SceneDocumentRegistry {
  private readonly _documents = new Map<string, ISceneDocument>();
  private _activeDocument: ISceneDocument | undefined;
  private _stateViewWebview: vscode.Webview | undefined;
  private _definitions: ObjectDefinitionPayload[] = [];
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  private readonly _onDocumentEdit = new vscode.EventEmitter<SceneDocumentEditEvent>();

  readonly onDidChange = this._onDidChange.event;
  readonly onDocumentEdit = this._onDocumentEdit.event;

  /** Register the state view webview so the registry can push scene updates to it. */
  setStateViewWebview(webview: vscode.Webview | undefined): void {
    this._stateViewWebview = webview;
  }

  /** Payload for the state view: active document as { name, uri, data }. */
  getDocumentsPayload(): SceneDocumentsPayload {
    const doc = this.getActiveDocument();
    if (!doc) return [];
    return [
      { name: path.basename(doc.uri.fsPath), uri: doc.uri.toString(), data: doc.getData() },
    ];
  }

  setDefinitions(definitions: ObjectDefinitionPayload[]): void {
    this._definitions = definitions;
  }

  getDefinitions(): ObjectDefinitionPayload[] {
    return this._definitions;
  }

  notifyStateView(): void {
    if (this._stateViewWebview) {
      this._stateViewWebview.postMessage({
        type: "update",
        documents: this.getDocumentsPayload(),
        definitions: this._definitions,
      });
    }
  }

  add(document: ISceneDocument): void {
    const key = document.uri.toString();
    if (this._documents.has(key)) return;
    this._documents.set(key, document);
    this._onDidChange.fire();
    this.notifyStateView();
  }

  remove(document: ISceneDocument): void {
    if (this._documents.delete(document.uri.toString())) {
      if (this._activeDocument?.uri.toString() === document.uri.toString()) {
        this._activeDocument = undefined;
      }
      this._onDidChange.fire();
      this.notifyStateView();
    }
  }

  getDocuments(): ISceneDocument[] {
    return Array.from(this._documents.values());
  }

  getDocumentByUri(uri: vscode.Uri): ISceneDocument | undefined {
    return this._documents.get(uri.toString());
  }

  getActiveDocument(): ISceneDocument | undefined {
    if (this._activeDocument && this._documents.has(this._activeDocument.uri.toString())) {
      return this._activeDocument;
    }
    return this.getDocuments()[0];
  }

  setActiveDocument(document: ISceneDocument | undefined): void {
    if (this._activeDocument === document) return;
    this._activeDocument = document;
    this._onDidChange.fire();
    this.notifyStateView();
  }

  notifyDocumentChanged(_document: ISceneDocument): void {
    this._onDidChange.fire();
    this.notifyStateView();
  }

  notifyDocumentEdited(document: ISceneDocument, previous: SceneData, next: SceneData): void {
    this._onDocumentEdit.fire({ document, previous, next });
  }
}
