import type { SceneChannelTransport } from "./sceneChannelTransport.js";
import { pathToPatch } from "./scenePatch.js";
import type { ScenePatch } from "./scenePatch.js";
import type { SceneObject, SceneUpdate } from "./scene.js";
import { getScene } from "./scene.js";

/** Scene data shape; matches core scene object (from scene.ts). */
export type SceneData = SceneObject;

export interface SceneWebviewMessage {
  type: string;
  content?: string;
  patch?: SceneData;
}

export const SCENE_CHANNEL = {
  requestInitialScene: "gameide.editor.requestInitialScene",
  initialScene: "gameide.editor.initialScene",
  scenePatch: "gameide.editor.scenePatch",
  sceneChanged: "gameide.editor.sceneChanged",
} as const;

export const SCENE_MESSAGE_TYPES = new Set([
  SCENE_CHANNEL.initialScene,
  SCENE_CHANNEL.scenePatch,
  SCENE_CHANNEL.sceneChanged,
]);

export type SceneChannelInMessage =
  | { type: typeof SCENE_CHANNEL.initialScene; content: string }
  | { type: typeof SCENE_CHANNEL.scenePatch; patch: ScenePatch };

export type SceneChannelOutMessage =
  | { type: typeof SCENE_CHANNEL.requestInitialScene }
  | { type: typeof SCENE_CHANNEL.scenePatch; patch: ScenePatch }
  | { type: typeof SCENE_CHANNEL.sceneChanged; content: string };

export interface CreateSceneChannelOptions {
  transport: SceneChannelTransport;
  getSceneData(): SceneData;
  setSceneData(data: SceneData): void;
  applyScenePatch: (scene: SceneData, patch: ScenePatch) => void;
  subscribeToUpdates?: (callback: (update: SceneUpdate) => void) => () => void;
  onRequestInitial?: () => string;
}

export interface SceneChannel {
  dispose(): void;
  pause(): void;
  unpause(): void;
  sendPatch(patch: ScenePatch): void;
  sendInitialScene(content: string): void;
  sendSceneChanged(content: string): void;
  requestInitialScene(): void;
}

export function createSceneChannel(
  options: CreateSceneChannelOptions
): SceneChannel {
  const { transport, getSceneData, setSceneData, applyScenePatch: applyPatch, subscribeToUpdates, onRequestInitial } = options;
  let paused = false;

  let initialSceneReceived = false;

  function sendPatch(patch: ScenePatch): void {
    transport.send({ type: SCENE_CHANNEL.scenePatch, patch });
  }

  function sendInitialScene(content: string): void {
    transport.send({ type: SCENE_CHANNEL.initialScene, content });
  }

  function sendSceneChanged(content: string): void {
    transport.send({ type: SCENE_CHANNEL.sceneChanged, content });
  }

  function requestInitialScene(): void {
    transport.send({ type: SCENE_CHANNEL.requestInitialScene });
  }

  function handleMessage(msg: unknown): void {
    if (!msg || typeof (msg as { type?: string }).type !== "string") return;
    const { type, content, patch } = msg as {
      type: string;
      content?: string;
      patch?: ScenePatch;
    };

    const isRequestInitial =
      type === SCENE_CHANNEL.requestInitialScene ||
      type === "requestInitialScene";
    const isInitialScene =
      type === SCENE_CHANNEL.initialScene ||
      type === "scene" ||
      type === "setSceneContent" ||
      type === "sceneUpdate";
    const isScenePatch =
      type === SCENE_CHANNEL.scenePatch || type === "scenePatch";
    const isSceneChanged =
      type === SCENE_CHANNEL.sceneChanged || type === "sceneChanged";

    if (isRequestInitial && onRequestInitial) {
      sendInitialScene(onRequestInitial());
      return;
    }

    if (paused) return;

    if (isInitialScene && content !== undefined) {
      try {
        const data = JSON.parse(content) as SceneData;
        setSceneData(data);
        initialSceneReceived = true;
      } catch {}
      return;
    }
    if (isScenePatch && patch !== undefined) {
      if (typeof patch !== "object" || Array.isArray(patch)) return;
      const previous = getSceneData();
      const updated = JSON.parse(JSON.stringify(previous)) as SceneData;
      applyPatch(updated, patch);
      setSceneData(updated);
      initialSceneReceived = true;
      return;
    }
    if (isSceneChanged && content !== undefined) {
      try {
        const data = JSON.parse(content) as SceneData;
        setSceneData(data);
      } catch {}
    }
  }

  const unsubscribeTransport = transport.onMessage(handleMessage);

  let unsubscribeOutgoing: (() => void) | undefined;
  if (subscribeToUpdates) {
    getScene();
    unsubscribeOutgoing = subscribeToUpdates((update: SceneUpdate) => {
      if (!initialSceneReceived || paused) return;
      const fullPath = [...update.path, update.key];
      const patch =
        update.type === "set"
          ? pathToPatch(fullPath, update.value)
          : pathToPatch(fullPath, undefined, true);
      sendPatch(patch);
    });
    requestInitialScene();
  }

  return {
    dispose() {
      unsubscribeTransport();
      unsubscribeOutgoing?.();
    },
    pause() {
      paused = true;
    },
    unpause() {
      paused = false;
    },
    sendPatch,
    sendInitialScene,
    sendSceneChanged,
    requestInitialScene,
  };
}
