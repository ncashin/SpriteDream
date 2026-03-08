/** Scene data: mutable JSON-like object used for .scene files and patches. */
export type SceneData = Record<string, unknown>;

/** Patch shape: same as SceneData; null at a key means delete. */
export type ScenePatch = Record<PropertyKey, unknown>;

/** Message sent to/from the scene webview (extension ↔ runtime iframe). */
export interface SceneWebviewMessage {
  type: string;
  content?: string;
  patch?: SceneData;
}
