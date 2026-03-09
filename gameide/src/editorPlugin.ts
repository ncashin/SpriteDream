import { createSceneTransportPostMessage } from "./sceneChannelTransport.js";
import { createSceneChannel } from "./sceneChannel.js";
import { applyScenePatch } from "./scenePatch.js";
import { GameIDEMode, setMode } from "./mode.js";
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
      if (typeof message.type !== "string") return;

      if (message.type === "gameide.editor.run") {
        setMode(GameIDEMode.Game);
        return;
      }
      if (message.type === "gameide.editor.stop") {
        setMode(GameIDEMode.Editor);
        return;
      }
    });
  }
  return input;
};
