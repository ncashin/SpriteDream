import type { SceneChannelTransport } from "./sceneChannelTransport.js";
import { setValueAtPath } from "../path.js";
import { SCENE_PATCH_DELETED, Scene, SceneObject, type ScenePath } from "../scene.js";

export const SCENE_CHANNEL = {
  requestInitialScene: "gameide.editor.requestInitialScene",
  initialScene: "gameide.editor.initialScene",
  scenePatch: "gameide.editor.scenePatch",
  sceneChange: "gameide.editor.sceneChange",
} as const;

export type SceneChannelMessage =
  | { type: typeof SCENE_CHANNEL.initialScene; content: SceneObject | string }
  | { type: typeof SCENE_CHANNEL.scenePatch; content: SceneObject }
  | { type: typeof SCENE_CHANNEL.requestInitialScene; content?: string }
  | { type: typeof SCENE_CHANNEL.sceneChange; content: SceneObject | string };

function parsePatchContent(content: SceneObject | string): SceneObject {
  if (typeof content === "string") {
    try {
      return JSON.parse(content) as SceneObject;
    } catch {
      return {};
    }
  }
  return content;
}

function scheduleNextAnimationFrame(callback: () => void): void {
  const requestAnimationFrameFunction = globalThis.requestAnimationFrame;
  if (typeof requestAnimationFrameFunction === "function") {
    requestAnimationFrameFunction.call(globalThis, callback);
  } else {
    setTimeout(callback, 0);
  }
}

export interface CreateSceneChannelOptions {
  transport: SceneChannelTransport;
  scene: Scene;
  initializeScene?: boolean;
  initialScenePath?: string;
  shouldBroadcastUpdate?: (path: ScenePath) => boolean;
  shouldRespondToInitialScene?: () => boolean;
}

export interface SceneChannel {
  dispose(): void;

  pause(): void;
  unpause(): void;

  requestInitialScene(): void;
  sendInitialScene(content: string): void;

  sendPatch(patch: SceneObject): void;

  sendSceneChange(content: string): void;
}

export async function createSceneChannel(
  options: CreateSceneChannelOptions,
): Promise<SceneChannel> {
  const {
    transport,
    scene,
    initializeScene = true,
    initialScenePath,
    shouldBroadcastUpdate,
    shouldRespondToInitialScene,
  } = options;
  let sceneInitialized = !initializeScene;
  let paused = false;
  let applyingRemoteChange = false;

  let markReady: () => void;
  const readyPromise = new Promise<void>((resolve) => {
    markReady = resolve;
    if (sceneInitialized) resolve();
  });

  function requestInitialScene(): void {
    transport.send({
      type: SCENE_CHANNEL.requestInitialScene,
      ...(initialScenePath ? { content: initialScenePath } : {}),
    });
  }
  function sendInitialScene(content: string): void {
    transport.send({ type: SCENE_CHANNEL.initialScene, content });
  }

  function sendPatch(content: SceneObject): void {
    transport.send({ type: SCENE_CHANNEL.scenePatch, content });
  }

  function sendSceneChange(content: string): void {
    transport.send({ type: SCENE_CHANNEL.sceneChange, content });
  }

  const pendingMessagesWhileWaiting: SceneChannelMessage[] = [];

  function finishSceneInitialization(content: SceneObject | string): void {
    if (sceneInitialized) return;
    sceneInitialized = true;
    if (requestInitialSceneTimer !== undefined) {
      clearInterval(requestInitialSceneTimer);
      requestInitialSceneTimer = undefined;
    }
    applyingRemoteChange = true;
    try {
      scene.replace(parsePatchContent(content));
      for (const message of pendingMessagesWhileWaiting) {
        if (message.type === SCENE_CHANNEL.scenePatch) {
          scene.applyPatch(message.content);
        } else if (message.type === SCENE_CHANNEL.sceneChange) {
          scene.replace(parsePatchContent(message.content));
        }
      }
    } finally {
      pendingMessagesWhileWaiting.length = 0;
      applyingRemoteChange = false;
      markReady();
    }
  }

  function handleMessage(message: SceneChannelMessage): void {
    switch (message.type) {
      case SCENE_CHANNEL.requestInitialScene:
        if (!sceneInitialized) return;
        if (shouldRespondToInitialScene && !shouldRespondToInitialScene()) return;
        try {
          sendInitialScene(JSON.stringify(scene.getRaw()));
        } catch {
          sendInitialScene("{}");
        }
        return;
      case SCENE_CHANNEL.initialScene: {
        finishSceneInitialization(message.content);
        return;
      }
      case SCENE_CHANNEL.scenePatch: {
        if (!sceneInitialized) {
          pendingMessagesWhileWaiting.push(message);
          return;
        }
        if (paused) return;
        applyingRemoteChange = true;
        try {
          scene.applyPatch(message.content);
        } finally {
          applyingRemoteChange = false;
        }
        return;
      }
      case SCENE_CHANNEL.sceneChange: {
        if (!sceneInitialized) {
          pendingMessagesWhileWaiting.push(message);
          return;
        }
        if (paused) return;
        applyingRemoteChange = true;
        try {
          scene.replace(parsePatchContent(message.content));
        } finally {
          applyingRemoteChange = false;
        }
        return;
      }
    }
  }

  const unsubscribeTransport = transport.onMessage(handleMessage as any);
  let requestInitialSceneTimer: ReturnType<typeof setInterval> | undefined;
  if (!sceneInitialized) {
    queueMicrotask(() => requestInitialScene());
    requestInitialSceneTimer = setInterval(() => {
      if (sceneInitialized) return;
      requestInitialScene();
    }, 1000);
  }

  let pendingPatch: SceneObject = {};
  let patchLoopDisposed = false;
  function patchFlushLoop(): void {
    if (patchLoopDisposed) return;
    scheduleNextAnimationFrame(patchFlushLoop);
    if (!sceneInitialized || paused) return;
    if (Object.keys(pendingPatch).length === 0) return;
    const patch = structuredClone(pendingPatch);
    pendingPatch = {};
    sendPatch(patch);
  }
  scheduleNextAnimationFrame(patchFlushLoop);

  const unsubscribeOnChange = scene.onChange((_object, property, newValue) => {
    if (!sceneInitialized || paused || applyingRemoteChange) return;
    if (shouldBroadcastUpdate && !shouldBroadcastUpdate(property)) return;
    setValueAtPath(
      pendingPatch,
      property,
      newValue === undefined ? SCENE_PATCH_DELETED : newValue,
    );
  });

  await readyPromise;

  return {
    dispose() {
      patchLoopDisposed = true;
      if (requestInitialSceneTimer !== undefined) {
        clearInterval(requestInitialSceneTimer);
      }
      unsubscribeTransport();
      unsubscribeOnChange?.();
    },
    pause() {
      paused = true;
      pendingPatch = {};
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
