import { createSceneTransportPostMessage } from "./sceneChannelTransport.js";
import { createSceneChannel } from "./sceneChannel.js";
import { applyScenePatch } from "./scenePatch.js";
import {
  getRootTarget,
  replaceScene,
  subscribeToSceneUpdates,
} from "./scene.js";
import { getMode, GameIDEMode } from "./mode.js";

export type ScenePatchMessage = Record<string, unknown>;

export const editorPlugin = () => (input: unknown) => {
  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.self !== window.top
  ) {
    return input;
  }
  
  createSceneChannel({
    transport: createSceneTransportPostMessage({
      target: window.parent,
      source: window,
    }),
    getSceneData: () => JSON.parse(JSON.stringify(getRootTarget() ?? {})),
    setSceneData: (data) => replaceScene(data),
    applyScenePatch,
    subscribeToUpdates: subscribeToSceneUpdates,
    getPaused: () => getMode() !== GameIDEMode.Editor,
  });

  return input;
};
