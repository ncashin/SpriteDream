import {
  SCENE_CHANNEL,
  type SceneEditorState,
} from "../../scene/sceneChannel/sceneChannel.js";
import { setScene, type SceneObject } from "../../scene/scene.js";

export const SCENES_API = "/__gameide/scenes";
export const SCENE_API = "/__gameide/scene";

function isSceneFileMessage(
  raw: unknown,
): raw is { type: string; content?: unknown } {
  return (
    !!raw &&
    typeof raw === "object" &&
    typeof (raw as { type?: unknown }).type === "string"
  );
}

function parseSceneEditorState(content: unknown): SceneEditorState | null {
  if (!content || typeof content !== "object") return null;
  const state = content as Partial<SceneEditorState>;
  if (typeof state.path !== "string") return null;
  if (typeof state.dirty !== "boolean") return null;
  if (typeof state.saving !== "boolean") return null;
  return { path: state.path, dirty: state.dirty, saving: state.saving };
}

export function isEmbeddedInParentFrame(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

export async function fetchSceneList(): Promise<string[]> {
  try {
    const res = await fetch(SCENES_API);
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

export function syncSceneQueryParam(relativePath: string): void {
  const url = new URL(window.location.href);
  if (relativePath) url.searchParams.set("scene", relativePath);
  else url.searchParams.delete("scene");
  history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export async function loadSceneFromDevServer(
  relativePath: string,
): Promise<SceneObject> {
  const res = await fetch(
    `${SCENE_API}?file=${encodeURIComponent(relativePath)}`,
  );
  if (!res.ok) throw new Error(`Failed to load scene (${res.status})`);
  return (await res.json()) as SceneObject;
}

export async function saveSceneToDevServer(
  relativePath: string,
  data: SceneObject,
): Promise<void> {
  const res = await fetch(
    `${SCENE_API}?file=${encodeURIComponent(relativePath)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error(`Failed to save scene (${res.status})`);
}

export function sceneSnapshot(data: SceneObject): string {
  return JSON.stringify(data);
}

export function initialScenePathFromUrl(
  scenes: readonly string[],
): string {
  const fromQuery = new URL(window.location.href).searchParams.get("scene");
  if (fromQuery && scenes.includes(fromQuery)) return fromQuery;
  return scenes[0] ?? "";
}

export async function switchSceneInDevServer(
  relativePath: string,
): Promise<SceneObject> {
  const data = await loadSceneFromDevServer(relativePath);
  setScene(data);
  syncSceneQueryParam(relativePath);
  return data;
}

export function requestHostSceneSave(): void {
  window.parent.postMessage({ type: SCENE_CHANNEL.requestSceneSave }, "*");
}

export function requestHostSceneSwitch(relativePath: string): void {
  window.parent.postMessage(
    { type: SCENE_CHANNEL.requestSceneSwitch, content: relativePath },
    "*",
  );
}

export function subscribeToSceneEditorState(
  handler: (state: SceneEditorState) => void,
): () => void {
  function onMessage(event: MessageEvent) {
    if (event.source !== window.parent) return;
    if (!isSceneFileMessage(event.data)) return;
    if (event.data.type !== SCENE_CHANNEL.sceneEditorState) return;

    const state = parseSceneEditorState(event.data.content);
    if (!state) return;
    handler(state);
  }

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
