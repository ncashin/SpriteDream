import type { MessageTransport } from "./messageChannel.js";
import { pathToPatch } from "./scenePatch.js";
import type { SceneData, ScenePatch } from "./types.js";
import type { SceneUpdate } from "./scene.js";
import { getScene } from "./scene.js";

export const SCENE_CHANNEL = {
  requestInitialScene: "gameide.editor.requestInitialScene",
  setSceneContent: "gameide.editor.setSceneContent",
  scenePatch: "gameide.editor.scenePatch",
} as const;

export type SceneChannelInMessage =
  | { type: typeof SCENE_CHANNEL.setSceneContent; content: string }
  | { type: typeof SCENE_CHANNEL.scenePatch; patch: ScenePatch };

export type SceneChannelOutMessage =
  | { type: typeof SCENE_CHANNEL.requestInitialScene }
  | { type: typeof SCENE_CHANNEL.scenePatch; patch: ScenePatch }
  | { type: typeof SCENE_CHANNEL.setSceneContent; content: string };

export interface SceneChannelContext {
  getSceneData(): SceneData;
  setSceneData(data: SceneData): void;
  applyScenePatch: (scene: SceneData, patch: ScenePatch) => void;
}

export interface SceneChannelOutgoingOptions {
  subscribeToUpdates: (callback: (update: SceneUpdate) => void) => () => void;
}

export interface CreateSceneChannelOptions {
  transport: MessageTransport;
  context: SceneChannelContext;
  outgoing?: SceneChannelOutgoingOptions;
  onRequestInitial?: () => string;
}

export interface SceneChannel {
  dispose(): void;
  sendPatch(patch: ScenePatch): void;
  sendSceneContent(content: string): void;
  requestInitialScene(): void;
}

export function createSceneChannel(
  options: CreateSceneChannelOptions
): SceneChannel {
  const { transport, context, outgoing, onRequestInitial } = options;
  const { getSceneData, setSceneData, applyScenePatch: applyPatch } = context;

  let initialSceneReceived = false;

  function sendPatch(patch: ScenePatch): void {
    transport.send({ type: SCENE_CHANNEL.scenePatch, patch });
  }

  function sendSceneContent(content: string): void {
    transport.send({ type: SCENE_CHANNEL.setSceneContent, content });
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
    const isSetSceneContent =
      type === SCENE_CHANNEL.setSceneContent ||
      type === "sceneUpdate" ||
      type === "sceneChanged";
    const isScenePatch =
      type === SCENE_CHANNEL.scenePatch || type === "scenePatch";

    if (isRequestInitial && onRequestInitial) {
      sendSceneContent(onRequestInitial());
      return;
    }

    if (isSetSceneContent && content !== undefined) {
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
  }

  const unsubscribeTransport = transport.onMessage(handleMessage);

  let unsubscribeOutgoing: (() => void) | undefined;
  if (outgoing) {
    getScene();
    unsubscribeOutgoing = outgoing.subscribeToUpdates((update: SceneUpdate) => {
      if (!initialSceneReceived) return;
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
    sendPatch,
    sendSceneContent,
    requestInitialScene,
  };
}
