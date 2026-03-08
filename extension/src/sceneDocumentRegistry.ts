import * as vscode from "vscode";
import type { SceneData } from "gameide";

export interface ISceneDocument {
  readonly uri: vscode.Uri;
  getData(): SceneData;
  setData(data: SceneData): void;
  notifyWebviews(): void;
}

export class SceneDocumentRegistry {
  private readonly _documents = new Map<string, ISceneDocument>();
  private _activeDocument: ISceneDocument | undefined;
  private readonly _onDidChange = new vscode.EventEmitter<void>();

  readonly onDidChange = this._onDidChange.event;

  add(document: ISceneDocument): void {
    const key = document.uri.toString();
    if (this._documents.has(key)) return;
    this._documents.set(key, document);
    this._onDidChange.fire();
  }

  remove(document: ISceneDocument): void {
    if (this._documents.delete(document.uri.toString())) {
      if (this._activeDocument?.uri.toString() === document.uri.toString()) {
        this._activeDocument = undefined;
      }
      this._onDidChange.fire();
    }
  }

  getDocuments(): ISceneDocument[] {
    return Array.from(this._documents.values());
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
  }

  notifyDocumentChanged(_document: ISceneDocument): void {
    this._onDidChange.fire();
  }
}
