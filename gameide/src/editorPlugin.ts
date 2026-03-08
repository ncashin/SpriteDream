import { createSceneTransportPostMessage } from "./sceneChannelTransport.js";
import { createSceneChannel } from "./sceneChannel.js";
import { applyScenePatch } from "./scenePatch.js";
import { getRootTarget, replaceScene, subscribeToSceneUpdates } from "./scene.js";

export type ScenePatchMessage = Record<string, unknown>;

export const editorPlugin = () =>
  (input: unknown) => {
    if (typeof window !== "undefined" && window.self !== window.top) {
      createSceneChannel({
        transport: createSceneTransportPostMessage({
          target: window.parent,
          source: window,
        }),
        getSceneData: () =>
          JSON.parse(JSON.stringify(getRootTarget() ?? {})),
        setSceneData: (data) => replaceScene(data),
        applyScenePatch,
        subscribeToUpdates: subscribeToSceneUpdates,
      });
    }
    return input;
  };
