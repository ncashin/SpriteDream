import { createSceneTransportPostMessage } from "../../scene/sceneChannel/sceneChannelTransport.js";
import { createSceneChannel } from "../../scene/sceneChannel/sceneChannel.js";
import type { SceneChannel } from "../../scene/sceneChannel/sceneChannel.js";
import { GameIDEMode, getMode, onModeChange } from "../../lifecycle/mode.js";
import type { GameContext } from "../../lifecycle/initialization.js";
import { createEditorUI } from "./createEditorUI.js";
import { DefaultEditor } from "./DefaultEditor.js";
import type { EditorWithGameViewReference } from "./createEditorUI.js";
import { restoreSceneSnapshot, saveSceneSnapshot } from "../../scene/snapshot.js";

export const editorPlugin =
  (Editor?: EditorWithGameViewReference) =>
  async (input: GameContext<object>) => {
    if (process.env.NODE_ENV !== "development") {
      return input;
    }

    const embeddedInParentIFrame =
       window && window.parent !== window;

    const channel = await createSceneChannel({
      transport: createSceneTransportPostMessage({
        target: window.parent,
        source: window,
      }),
      scene: input.scene,
      initializeScene: embeddedInParentIFrame,
    });


    const handleModeChange = (mode: GameIDEMode) => {
      switch (mode) {
        case GameIDEMode.Game:
          saveSceneSnapshot();
          channel.pause();
          break;
        case GameIDEMode.Editor:
          restoreSceneSnapshot();
          channel.unpause();

          break;
      }
    };

    handleModeChange(getMode());
    const releaseModeWatcher = onModeChange(handleModeChange);

    const mount = await createEditorUI(
      input.rootElement,
      Editor ?? DefaultEditor,
    );
    
    input.dispose(() => {
      releaseModeWatcher();
      channel.dispose();
      mount.dispose();
    });

    return {
      ...input,
      rootElement: mount.gameViewRoot,
      editorSceneChannel: channel,
    };
  };
