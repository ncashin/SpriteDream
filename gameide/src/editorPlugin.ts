import { createSceneTransportPostMessage } from "./sceneChannelTransport.js";
import { createSceneChannel } from "./sceneChannel.js";
import { applyScenePatch } from "./scenePatch.js";
import { setGameRunning } from "./gameloop.js";
import {
  getRootTarget,
  replaceScene,
  subscribeToSceneUpdates,
} from "./scene.js";

export type ScenePatchMessage = Record<string, unknown>;

export const editorPlugin = () => (input: unknown) => {
  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.self !== window.top
  ) {
    createSceneChannel({
      transport: createSceneTransportPostMessage({
        target: window.parent,
        source: window,
      }),
      getSceneData: () => JSON.parse(JSON.stringify(getRootTarget() ?? {})),
      setSceneData: (data) => replaceScene(data),
      applyScenePatch,
      subscribeToUpdates: subscribeToSceneUpdates,
    });

    window.addEventListener("message", (event: MessageEvent) => {
      const message = event.data;
      if (message && typeof message.type === "string") {
        if (message.type === "gameide.editor.run") setGameRunning(true);
        else if (message.type === "gameide.editor.stop") setGameRunning(false);
      }
    });
  }
  return input;
};
