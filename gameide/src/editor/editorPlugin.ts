import { createSceneTransportPostMessage } from "../scene/sceneChannel/sceneChannelTransport.js";
import { createSceneChannel } from "../scene/sceneChannel/sceneChannel.js";
import type { SceneChannel } from "../scene/sceneChannel/sceneChannel.js";
import {
  getScene,
  getRawScene,
  setScene,
  subscribeToScene,
  applyPatch,
  restoreSceneSnapshot,
  saveSceneSnapshot,
} from "../scene/scene.js";
import { GameIDEMode, getMode, onModeChange } from "../lifecycle/mode.js";
import { createEditorUI } from "./createEditorUI.js";
import { DefaultEditor } from "./DefaultEditor.js";
import type { EditorWithGameViewReference } from "./createEditorUI.js";

export const editorPlugin =
  (Editor?: EditorWithGameViewReference) =>
  async (input: { rootElement: HTMLElement; dispose: (fn: () => void) => void }) => {
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

    const releaseModeWatcher = onModeChange((mode, previousMode) => {
      if (
        previousMode === GameIDEMode.Editor &&
        mode === GameIDEMode.Game
      ) {
        saveSceneSnapshot();
        channel.pause();
      }
    });

    const mount = await createEditorUI(
      input.rootElement,
      Editor ?? DefaultEditor,
    );

    if (getMode() === GameIDEMode.Editor) {
      restoreSceneSnapshot();
      channel.unpause();
    }

    input.dispose(() => {
      releaseModeWatcher();
      channel.dispose();
      mount.dispose();
    });

    return {
      ...input,
      rootElement: mount.gameViewRoot,
      editorSceneChannel: channel as SceneChannel,
    };
  };
