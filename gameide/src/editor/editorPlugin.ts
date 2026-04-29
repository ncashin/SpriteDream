import { createSceneTransportPostMessage } from "../scene/sceneChannel/sceneChannelTransport.js";
import { createSceneChannel } from "../scene/sceneChannel/sceneChannel.js";
import type { BaseSceneObject } from "../scene/scene.js";
import {
  getScene,
  getRawScene,
  setScene,
  subscribeToScene,
  saveSceneSnapshot,
  restoreSceneSnapshot,
  applyPatch,
} from "../scene/scene.js";
import { GameIDEMode, getMode, onModeChange } from "../lifecycle/mode.js";
import { createEditorUI } from "./createEditorUI.js";
import { DefaultEditor } from "./DefaultEditor.js";
import type { EditorWithGameViewReference } from "./createEditorUI.js";

export const editorPlugin =
  (Editor?: EditorWithGameViewReference) =>
  async (input: { rootElement: HTMLElement }) => {
    if (process.env.NODE_ENV !== "development") {
      return input;
    }

    const channel = await createSceneChannel({
      transport: createSceneTransportPostMessage({
        target: window.parent,
        source: window,
      }),
      getScene,
      getRawScene,
      setScene,
      subscribeToScene,

      applyPatch,

      initializeScene: false,
    });

    const gameViewRoot = await createEditorUI(
      input.rootElement,
      Editor ?? DefaultEditor,
    );

    onModeChange((mode) => {
      switch (mode) {
        case GameIDEMode.Editor:
          restoreSceneSnapshot();
          channel.unpause();
          break;

        case GameIDEMode.Game:
          saveSceneSnapshot();
          channel.pause();
          break;

        default:
          break;
      }
    });

    return { ...input, rootElement: gameViewRoot };
  };
