import type { SceneChannelTransport } from "./sceneChannelTransport.js";
import { setValueAtPath } from "../path.js";
import { Scene, SceneObject } from "../scene.js";

export const SCENE_CHANNEL = {
  requestInitialScene: "gameide.editor.requestInitialScene",
  initialScene: "gameide.editor.initialScene",
  scenePatch: "gameide.editor.scenePatch",
  sceneChange: "gameide.editor.sceneChange",
  sceneEditorState: "gameide.editor.sceneEditorState",
  requestSceneSwitch: "gameide.editor.requestSceneSwitch",
  requestSceneSave: "gameide.editor.requestSceneSave",
} as const;

export type SceneEditorState = {
  path: string;
  dirty: boolean;
  saving: boolean;
};

export type SceneChannelMessage =
  | { type: typeof SCENE_CHANNEL.initialScene; content: SceneObject | string }
  | { type: typeof SCENE_CHANNEL.scenePatch; content: SceneObject }
  | { type: typeof SCENE_CHANNEL.requestInitialScene; content?: string }
  | { type: typeof SCENE_CHANNEL.sceneChange; content: SceneObject | string }
  | { type: typeof SCENE_CHANNEL.sceneEditorState; content: SceneEditorState }
  | { type: typeof SCENE_CHANNEL.requestSceneSwitch; content: string }
  | { type: typeof SCENE_CHANNEL.requestSceneSave };

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
  const { transport, scene, initializeScene = true, initialScenePath } = options;
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

  function handleMessage(message: SceneChannelMessage): void {
    switch (message.type) {
      case SCENE_CHANNEL.requestInitialScene:
        try {
          sendInitialScene(JSON.stringify(scene.getRaw()));
        } catch {
          sendInitialScene("{}");
        }
        return;
      case SCENE_CHANNEL.initialScene: {
        if (sceneInitialized) return;
        sceneInitialized = true;
        applyingRemoteChange = true;
        try {
          scene.replace(parsePatchContent(message.content));
        } finally {
          applyingRemoteChange = false;
          markReady();
        }
        return;
      }
      case SCENE_CHANNEL.scenePatch: {
        if (!sceneInitialized || paused) return;
        applyingRemoteChange = true;
        try {
          scene.applyPatch(message.content);
        } finally {
          applyingRemoteChange = false;
        }
        return;
      }
      case SCENE_CHANNEL.sceneChange: {
        if (!sceneInitialized || paused) return;
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
  if (!sceneInitialized) {
    queueMicrotask(() => requestInitialScene());
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
    setValueAtPath(pendingPatch, property, newValue);
  });

  await readyPromise;

  return {
    dispose() {
      patchLoopDisposed = true;
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
