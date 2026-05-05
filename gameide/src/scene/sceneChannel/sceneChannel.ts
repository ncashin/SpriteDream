import type { SceneChannelTransport } from "./sceneChannelTransport.js";
import { invalidateUseSceneSnapshot } from "../../hooks/useSceneSnapshot.js";
import {
  type BaseSceneObject,
  type SceneReflectUpdate,
  mergeSceneReflectUpdateIntoPatch,
} from "../scene.js";

export type { SceneReflectUpdate };

export const SCENE_CHANNEL = {
  requestInitialScene: "gameide.editor.requestInitialScene",
  initialScene: "gameide.editor.initialScene",
  scenePatch: "gameide.editor.scenePatch",
  sceneChange: "gameide.editor.sceneChange",
} as const;

export type SceneChannelMessage =
  | { type: typeof SCENE_CHANNEL.initialScene; content: string }
  | { type: typeof SCENE_CHANNEL.scenePatch; patch: BaseSceneObject }
  | { type: typeof SCENE_CHANNEL.requestInitialScene }
  | { type: typeof SCENE_CHANNEL.sceneChange; content: string };

export interface CreateSceneChannelOptions {
  transport: SceneChannelTransport;
  getScene(): BaseSceneObject;
  getRawScene?: () => BaseSceneObject;
  setScene(data: BaseSceneObject): void;
  subscribeToScene?: (
    callback: (update: SceneReflectUpdate) => void,
  ) => () => void;
  applyPatch: (scene: BaseSceneObject, patch: BaseSceneObject) => void;
  shouldEmitSceneUpdate?: (update: SceneReflectUpdate) => boolean;
  getInitialSceneContent?: () => string;

  initializeScene?: boolean;
}

export interface SceneChannel {
  dispose(): void;

  pause(): void;
  unpause(): void;

  requestInitialScene(): void;
  sendInitialScene(content: string): void;

  sendPatch(patch: BaseSceneObject): void;

  sendSceneChange(content: string): void;
}

export async function createSceneChannel(
  options: CreateSceneChannelOptions,
): Promise<SceneChannel> {
  const {
    transport,
    getScene,
    getRawScene,
    setScene,
    applyPatch: applyPatch,
    subscribeToScene,
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

  function sendPatch(patch: BaseSceneObject): void {
    transport.send({ type: SCENE_CHANNEL.scenePatch, patch });
  }

  function sendSceneChange(content: string): void {
    transport.send({ type: SCENE_CHANNEL.sceneChange, content });
  }

  function handleMessage(message: SceneChannelMessage): void {
    switch (message.type) {
      case SCENE_CHANNEL.requestInitialScene:
        if (getInitialSceneContent) {
          sendInitialScene(getInitialSceneContent());
        }
        return;
      case SCENE_CHANNEL.initialScene: {
        if (sceneInitialized) return;
        sceneInitialized = true;
        const data = JSON.parse(message.content);
        setScene(data);
        markReady();
        return;
      }
      case SCENE_CHANNEL.scenePatch: {
        if (!sceneInitialized || paused) return;
        const sceneForPatch = getRawScene?.() ?? getScene();
        applyPatch(sceneForPatch, message.patch);
        invalidateUseSceneSnapshot();
        return;
      }
      case SCENE_CHANNEL.sceneChange: {
        if (!sceneInitialized || paused) return;
        const data = JSON.parse(message.content);
        setScene(data);
        return;
      }
    }
  }

  const unsubscribeTransport = transport.onMessage(handleMessage as any);
  if (!sceneInitialized) {
    requestInitialScene();
  }

  let unsubscribeOutgoing: (() => void) | undefined;
  let pendingPatch: BaseSceneObject = {};

  function patchFlushLoop(): void {
    requestAnimationFrame(patchFlushLoop);
    if (!sceneInitialized || paused) return;
    if (Object.keys(pendingPatch).length === 0) return;
    const patch = structuredClone(pendingPatch) as BaseSceneObject;
    pendingPatch = {};
    sendPatch(patch);
  }

  if (subscribeToScene) {
    unsubscribeOutgoing = subscribeToScene((update: SceneReflectUpdate) => {
      if (!sceneInitialized || paused) return;
      if (shouldEmitSceneUpdate && !shouldEmitSceneUpdate(update)) return;
      mergeSceneReflectUpdateIntoPatch(pendingPatch, update);
    });
    requestAnimationFrame(patchFlushLoop);
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
