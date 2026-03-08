import { createPostMessageTransport } from "./messageChannel.js";
import { createSceneChannel } from "./sceneChannel.js";
import { applyScenePatch } from "./scenePatch.js";
import { getRootTarget, replaceScene, subscribeToSceneUpdates } from "./scene.js";

export type ScenePatchMessage = Record<string, unknown>;

export const editorPlugin = () =>
  (input: unknown) => {
    if (typeof window !== "undefined" && window.self !== window.top) {
      createSceneChannel({
        transport: createPostMessageTransport({
          target: window.parent,
          source: window,
        }),
        context: {
          getSceneData: () =>
            JSON.parse(JSON.stringify(getRootTarget() ?? {})),
          setSceneData: (data) => replaceScene(data),
          applyScenePatch,
        },
        outgoing: { subscribeToUpdates: subscribeToSceneUpdates },
      });
    }
    return input;
  };
