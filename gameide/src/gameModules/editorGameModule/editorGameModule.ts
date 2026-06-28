import { GameIDEMode, getMode, onModeChange } from "../../lifecycle/mode.js";
import type { GameContext } from "../../lifecycle/initialization.js";
import { createEditorUI } from "./createEditorUI.js";
import type { EditorWithGameViewReference } from "./createEditorUI.js";
import {
  createSceneSnapshot,
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
