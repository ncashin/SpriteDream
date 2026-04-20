import { createSceneTransportPostMessage } from "../scene/sceneChannelTransport.js";
import { createSceneChannel } from "../scene/sceneChannel.js";
import type { SceneObject } from "../scene/scene.js";
import {
  getScene,
  getSceneRaw,
  setScene,
  restoreSceneSnapshot,
  saveSceneSnapshot,
  onSceneUpdate,
  applyScenePatchToRootTarget,
} from "../scene/scene.js";
import { GameIDEMode, getMode, onModeChange } from "../mode.js";
import type { GameIDEPluginContext } from "../initializeGame.js";
import { createEditorUI } from "./createEditorUI.js";
import { DefaultEditor } from "./DefaultEditor.js";
import type { EditorWithGameViewRef } from "./createEditorUI.js";

export type ScenePatchMessage = Record<string, unknown>;

export const editorPlugin =
  (Editor?: EditorWithGameViewRef) =>
  async (input: GameIDEPluginContext) => {
    if (process.env.NODE_ENV !== "development") {
      return input;
    }

    const channel = await createSceneChannel({
      transport: createSceneTransportPostMessage({
        target: window.parent,
        source: window,
      }),
      getScene,
      setScene,
      onSceneUpdate,

      applyScenePatch: (_scene, patch) => applyScenePatchToRootTarget(patch),

      initializeScene: false,
    });

    const gameViewRoot = await createEditorUI(
      input.rootElement,
      Editor ?? DefaultEditor,
    );

    if (getMode() === GameIDEMode.Editor) {
      saveSceneSnapshot();
    }

    onModeChange((mode) => {
      switch (mode) {
        case GameIDEMode.Editor:
          restoreSceneSnapshot();
          channel.unpause();
          break;

        case GameIDEMode.Game:
          getScene();
          saveSceneSnapshot();
          channel.pause();
          break;

        default:
          break;
      }
    });

    return { ...input, rootElement: gameViewRoot };
  };
