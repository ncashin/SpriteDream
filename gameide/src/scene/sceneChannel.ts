import type { SceneChannelTransport } from "./sceneChannelTransport.js";
import { patchAtPath, type ScenePatch } from "./scenePatch.js";
import { appendKeyToPath } from "./scenePath.js";
import { invalidateUseSceneSnapshot } from "../editor/useSceneSnapshot.js";
import type { SceneObjectData, SceneUpdate } from "./scene.js";

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
  getScene(): SceneData;
  setScene(data: SceneData): void;
  onSceneUpdate?: (callback: (update: SceneUpdate) => void) => () => void;
  applyScenePatch: (scene: SceneData, patch: ScenePatch) => void;
  shouldEmitSceneUpdate?: (update: SceneUpdate) => boolean;
  getInitialSceneContent?: () => string;

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
    getScene,
    setScene,
    applyScenePatch: applyPatch,
    onSceneUpdate,
    shouldEmitSceneUpdate,
    getInitialSceneContent,

    initializeScene = true,
  } = options;
  let sceneInitialized = !initializeScene;
  let paused = false;

  let markReady: () => void;
  const readyPromise = new Promise<void>((resolve) => {
    markReady = resolve;
    if (sceneInitialized) resolve();
  });

  function requestInitialScene(): void {
    transport.send({ type: SCENE_CHANNEL.requestInitialScene });
  }
  function sendInitialScene(content: string): void {
    transport.send({ type: SCENE_CHANNEL.initialScene, content });
  }

  function sendPatch(patch: ScenePatch): void {
    transport.send({ type: SCENE_CHANNEL.scenePatch, patch });
  }

  function sendSceneChange(content: string): void {
    transport.send({ type: SCENE_CHANNEL.sceneChange, content });
  }
  

  function handleMessage(message: SceneChannelMessage): void {
    console.log(message)
    switch (message.type) {
      case SCENE_CHANNEL.requestInitialScene:
        if (sceneInitialized && getInitialSceneContent) {
          sendInitialScene(getInitialSceneContent());
        }
        return;
      case SCENE_CHANNEL.initialScene: {
        if (sceneInitialized) return;
        sceneInitialized = true;
        const data = JSON.parse(message.content) as SceneData;
        setScene(data);
        markReady();
        return;
      }
      case SCENE_CHANNEL.scenePatch: {
        if (!sceneInitialized || paused) return;
        applyPatch(getScene(), message.patch);
        invalidateUseSceneSnapshot();
        return;
      }
      case SCENE_CHANNEL.sceneChange: {
        if (!sceneInitialized || paused) return;
        const data = JSON.parse(message.content) as SceneData;
        setScene(data);
        return;
      }
    }
  }

  const unsubscribeTransport = transport.onMessage(handleMessage as any);
  if (!sceneInitialized){
    requestInitialScene();
  }

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
  if (onSceneUpdate) {
    unsubscribeOutgoing = onSceneUpdate((update: SceneUpdate) => {
      if (!sceneInitialized || paused) return;
      if (shouldEmitSceneUpdate && !shouldEmitSceneUpdate(update)) return;
      sendPatch(patchForSceneUpdate(update));
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
