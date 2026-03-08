import type { SceneUpdate } from "./scene";
import {
  getScene,
  getRootTarget,
  replaceScene,
  subscribeToSceneUpdates,
} from "./scene";
import { applyScenePatch, pathToPatch } from "./scenePatch";

export type ScenePatchMessage = Record<string, unknown>;

let initialSceneReceived = false;

function sendPatchToExtension(path: PropertyKey[], value?: unknown, isDelete?: boolean): void {
  if (!initialSceneReceived) return;
  const patch: ScenePatchMessage = pathToPatch(path, value, isDelete);
  window.parent.postMessage({ type: "gameide.scenePatch", patch }, "*");
}

function handleSceneUpdate(update: SceneUpdate): void {
  const fullPath = [...update.path, update.key];
  if (update.type === "set") {
    sendPatchToExtension(fullPath, update.value);
  } else {
    sendPatchToExtension(fullPath, undefined, true);
  }
}

function handleMessage(event: MessageEvent): void {
  const msg = event.data;
  if (!msg || typeof msg.type !== "string") return;

  if (msg.type === "gameide.sceneUpdate" && msg.content !== undefined) {
    try {
      const data = JSON.parse(msg.content) as Record<PropertyKey, unknown>;
      replaceScene(data);
      initialSceneReceived = true;
    } catch {
      // ignore parse errors
    }
    return;
  }

  if (msg.type === "gameide.scenePatch" && msg.patch && typeof msg.patch === "object" && !Array.isArray(msg.patch)) {
    const root = getRootTarget();
    if (!root) return;
    applyScenePatch(root, msg.patch as Record<PropertyKey, unknown>);
  }
}

function initializeIframe(): void {
  getScene();
  subscribeToSceneUpdates(handleSceneUpdate);
  window.addEventListener("message", handleMessage);
  window.parent.postMessage({ type: "gameide.requestInitialScene" }, "*");
}

export const iframePlugin = () => 
   (input: unknown) => {
    if (typeof window !== "undefined" && window.self !== window.top) {
      initializeIframe();
    }
    return input;
  };

