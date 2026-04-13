import type { SceneChannelTransport } from "./sceneChannelTransport.js";
import { patchAtPath, type ScenePatch } from "./scenePatch.js";
import { appendKeyToPath } from "./scenePath.js";
import type { SceneObjectData, SceneUpdate } from "./scene.js";
import { getScene } from "./scene.js";

export type SceneData = SceneObjectData;

export interface SceneWebviewMessage {
  type: string;
  content?: string;
  patch?: SceneData;
}

export const SCENE_CHANNEL = {
  requestInitialScene: "gameide.editor.requestInitialScene",
  initialScene: "gameide.editor.initialScene",
  scenePatch: "gameide.editor.scenePatch",
  sceneChange: "gameide.editor.sceneChange",
} as const;

export const SCENE_MESSAGE_TYPES = new Set([
  SCENE_CHANNEL.initialScene,
  SCENE_CHANNEL.scenePatch,
  SCENE_CHANNEL.sceneChange,
]);

export type SceneChannelMessage =
  | { type: typeof SCENE_CHANNEL.initialScene; content: string }
  | { type: typeof SCENE_CHANNEL.scenePatch; patch: ScenePatch }
  | { type: typeof SCENE_CHANNEL.requestInitialScene }
  | { type: typeof SCENE_CHANNEL.sceneChange; content: string };

export interface CreateSceneChannelOptions {
  transport: SceneChannelTransport;
  getSceneData(): SceneData;
  setSceneData(data: SceneData): void;
  applyScenePatch: (scene: SceneData, patch: ScenePatch) => void;
  subscribeToUpdates?: (callback: (update: SceneUpdate) => void) => () => void;
  shouldEmitSceneUpdate?: (update: SceneUpdate) => boolean;
  getInitializationPayload?: () => string;

  initializeScene?: boolean;
}

export interface SceneChannel {
  dispose(): void;
  
  pause(): void;
  unpause(): void;

  requestInitialScene(): void;
  sendInitialScene(content: string): void;

  sendPatch(patch: ScenePatch): void;

  sendSceneChange(content: string): void;
}

export async function createSceneChannel(
  options: CreateSceneChannelOptions,
): Promise<SceneChannel> {
  const {
    transport,
    getSceneData,
    setSceneData,
    applyScenePatch: applyPatch,
    subscribeToUpdates,
    getInitializationPayload: onRequestInitial,
    shouldEmitSceneUpdate,
    initializeScene: awaitInitialSceneSnapshot = false,
  } = options;
  let paused = false;
  let initialSceneReceived = !awaitInitialSceneSnapshot;

  let markReady = () => {};
  const readyPromise =
    subscribeToUpdates !== undefined
      ? new Promise<void>((resolve) => {
          markReady = () => resolve();
        })
      : Promise.resolve();

  function sendPatch(patch: ScenePatch): void {
    transport.send({ type: SCENE_CHANNEL.scenePatch, patch });
  }

  function sendInitialScene(content: string): void {
    transport.send({ type: SCENE_CHANNEL.initialScene, content });
  }

  function sendSceneChange(content: string): void {
    transport.send({ type: SCENE_CHANNEL.sceneChange, content });
  }

  function requestInitialScene(): void {
    transport.send({ type: SCENE_CHANNEL.requestInitialScene });
  }

  if (subscribeToUpdates) {
    getScene();
    if (initialSceneReceived) {
      markReady();
    }
  }

  function handleMessage(message: SceneChannelMessage): void {
    switch (message.type) {
      case SCENE_CHANNEL.requestInitialScene:
        if (onRequestInitial) {
          sendInitialScene(onRequestInitial());
        }
        return;
      case SCENE_CHANNEL.initialScene: {
        if (paused) return;
        if (initialSceneReceived) return;
        try {
          const data = JSON.parse(message.content) as SceneData;
          setSceneData(data);
          initialSceneReceived = true;
          markReady();
        } catch {}
        return;
      }
      case SCENE_CHANNEL.scenePatch: {
        if (paused) return;
        applyPatch(getSceneData(), message.patch);
        return;
      }
      case SCENE_CHANNEL.sceneChange: {
        if (paused) return;
        try {
          const data = JSON.parse(message.content) as SceneData;
          setSceneData(data);
        } catch {}
        return;
      }
    }
  }

  const unsubscribeTransport = transport.onMessage(handleMessage as any);

  function patchForSceneUpdate(update: SceneUpdate): ScenePatch {
    const fullPath = appendKeyToPath(update.path, update.key);
    switch (update.type) {
      case "set":
        return patchAtPath(fullPath, update.value);
      case "delete":
        return patchAtPath(fullPath, undefined, true);
    }
  }

  let unsubscribeOutgoing: (() => void) | undefined;
  if (subscribeToUpdates) {
    unsubscribeOutgoing = subscribeToUpdates((update: SceneUpdate) => {
      if (!initialSceneReceived || paused) return;
      if (shouldEmitSceneUpdate && !shouldEmitSceneUpdate(update)) return;
      sendPatch(patchForSceneUpdate(update));
    });
    queueMicrotask(() => {
      if (initialSceneReceived) return;
      requestInitialScene();
    });
  }

  await readyPromise;

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
    sendSceneChange,
    requestInitialScene,
  };
}
