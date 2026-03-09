import { createSceneTransportPostMessage } from "./sceneChannelTransport.js";
import { createSceneChannel } from "./sceneChannel.js";
import { applyScenePatch } from "./scenePatch.js";
import { GameIDEMode, getMode, setMode, onModeChange } from "./mode.js";
import {
  getRootTarget,
  replaceScene,
  subscribeToSceneUpdates,
} from "./scene.js";

export const EDITOR_MODE_MESSAGE_TYPE = "gameide.editor.mode";

export type ScenePatchMessage = Record<string, unknown>;

export const editorPlugin = () => (input: unknown) => {
  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.self !== window.top
  ) {
    const sceneChannel = createSceneChannel({
      transport: createSceneTransportPostMessage({
        target: window.parent,
        source: window,
      }),
      getSceneData: () => JSON.parse(JSON.stringify(getRootTarget() ?? {})),
      setSceneData: (data) => replaceScene(data),
      applyScenePatch,
      subscribeToUpdates: subscribeToSceneUpdates,
    });

    onModeChange((mode) => {
      window.parent.postMessage(
        { type: EDITOR_MODE_MESSAGE_TYPE, mode },
        "*"
      );
    });
    window.parent.postMessage(
      { type: EDITOR_MODE_MESSAGE_TYPE, mode: getMode() },
      "*"
    );

    window.addEventListener("message", (event: MessageEvent) => {
      const message = event.data;
      if (typeof message.type !== "string") return;

      if (message.type === "gameide.editor.run") {
        setMode(GameIDEMode.Game);
        return;
      }
      if (message.type === "gameide.editor.stop") {
        setMode(GameIDEMode.Editor);
        sceneChannel.sendSceneChanged(
          JSON.stringify(getRootTarget() ?? {}, null, 2)
        );
        return;
      }
    });
  }
  return input;
};
