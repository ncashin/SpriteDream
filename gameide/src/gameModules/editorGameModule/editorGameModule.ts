import { GameIDEMode, getMode, onModeChange } from "../../lifecycle/mode.js";
import type { GameContext } from "../../lifecycle/initialization.js";
import { createEditorUI } from "./createEditorUI.js";
import type { Editor } from "./createEditorUI.js";
import {
  createSceneSnapshot,
} from "../../scene/sceneSnapshot.js";
import { initializeSceneFileStore } from "./sceneFile/sceneFileStore.js";

export default function editorGameModule(Editor: Editor) {
  return async (input: GameContext) => {
    if (process.env.NODE_ENV !== "development") {
      return input;
    }

    await initializeSceneFileStore(input.scene);

    const sceneSnapshot = createSceneSnapshot(input.scene);

    const handleModeChange = (mode: GameIDEMode) => {
      switch (mode) {
        case GameIDEMode.Game:
          sceneSnapshot.save();
          break;
        case GameIDEMode.Editor:
          sceneSnapshot.restore();
          break;
      }
    };

    handleModeChange(getMode());
    const releaseModeWatcher = onModeChange(handleModeChange);

    const mount = await createEditorUI(input.rootElement, Editor, input.scene);

    input.onDispose(() => {
      releaseModeWatcher();
      mount.dispose();
    });

    return {
      ...input,
      initialScene: structuredClone(input.scene.getRaw()),
      rootElement: mount.gameViewRoot,
    };
  };
}
