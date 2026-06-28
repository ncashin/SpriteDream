import { GameIDEMode, getMode, onModeChange } from "../../lifecycle/mode.js";
import type { GameContext } from "../../lifecycle/initialization.js";
import { createEditorUI } from "./createEditorUI.js";
import type { EditorWithGameViewReference } from "./createEditorUI.js";
import {
  restoreSceneSnapshot,
  saveSceneSnapshot,
} from "../../scene/snapshot.js";
import {
  bindSceneFileStore,
  hydrateSceneFileStore,
  subscribeSceneFileHostState,
  useSceneFileStore,
} from "./sceneFile/sceneFileStore.js";

export const editorGameModule =
  (Editor: EditorWithGameViewReference) =>
  async (input: GameContext<object>) => {
    if (process.env.NODE_ENV !== "development") {
      return input;
    }

    const persistedScenePath = await hydrateSceneFileStore();
    const releaseSceneFileHostState = subscribeSceneFileHostState();

    const releaseSceneFileStore = bindSceneFileStore(
      input.scene,
      persistedScenePath || undefined,
    );

    void useSceneFileStore.getState().loadScenes();

    const handleModeChange = (mode: GameIDEMode) => {
      switch (mode) {
        case GameIDEMode.Game:
          saveSceneSnapshot();
          break;
        case GameIDEMode.Editor:
          restoreSceneSnapshot();
          break;
      }
    };

    handleModeChange(getMode());
    const releaseModeWatcher = onModeChange(handleModeChange);

    const mount = await createEditorUI(input.rootElement, Editor);

    input.onDispose(() => {
      releaseModeWatcher();
      releaseSceneFileHostState();
      releaseSceneFileStore();
      mount.dispose();
    });

    return {
      ...input,
      initialScene: structuredClone(input.scene.getRaw()),
      rootElement: mount.gameViewRoot,
    };
  };
