import { createSceneTransportPostMessage } from "../../scene/sceneChannel/sceneChannelTransport.js";
import { createSceneChannel } from "../../scene/sceneChannel/sceneChannel.js";
import type { SceneChannel } from "../../scene/sceneChannel/sceneChannel.js";
import { GameIDEMode, getMode, onModeChange } from "../../lifecycle/mode.js";
import type { GameContext } from "../../lifecycle/initialization.js";
import { createEditorUI } from "./createEditorUI.js";
import type { EditorWithGameViewReference } from "./createEditorUI.js";
import { restoreSceneSnapshot, saveSceneSnapshot } from "../../scene/snapshot.js";
import {
  bindSceneFileStore,
  hydrateSceneFileStore,
  subscribeSceneFileHostState,
  useSceneFileStore,
} from "../../scene/sceneFileStore.js";

export const editorPlugin =
  (Editor: EditorWithGameViewReference) =>
  async (input: GameContext<object>) => {
    if (process.env.NODE_ENV !== "development") {
      return input;
    }

    const persistedScenePath = await hydrateSceneFileStore();
    const releaseSceneFileHostState = subscribeSceneFileHostState();

    await useSceneFileStore.getState().loadScenes();

    const embeddedInParentIFrame = window && window.parent !== window;
    let channel: SceneChannel | undefined;
    let releaseDevRuntime: (() => void) | undefined;

    if (embeddedInParentIFrame) {
      const transport = createSceneTransportPostMessage({
        target: window.parent,
        source: window,
      });
      channel = await createSceneChannel({
        transport,
        scene: input.scene,
        initializeScene: true,
        initialScenePath: persistedScenePath || undefined,
      });
    } else {
      const activeScenePath =
        useSceneFileStore.getState().activeScenePath || persistedScenePath;
      releaseDevRuntime = bindSceneFileStore(
        input.scene,
        activeScenePath || undefined,
      );
    }

    const handleModeChange = (mode: GameIDEMode) => {
      switch (mode) {
        case GameIDEMode.Game:
          saveSceneSnapshot();
          channel?.pause();
          break;
        case GameIDEMode.Editor:
          restoreSceneSnapshot();
          channel?.unpause();
          break;
      }
    };

    handleModeChange(getMode());
    const releaseModeWatcher = onModeChange(handleModeChange);

    const mount = await createEditorUI(input.rootElement, Editor);

    input.dispose(() => {
      releaseModeWatcher();
      releaseSceneFileHostState();
      releaseDevRuntime?.();
      channel?.dispose();
      mount.dispose();
    });

    return {
      ...input,
      initialScene: structuredClone(input.scene.getRaw()),
      rootElement: mount.gameViewRoot,
      ...(channel ? { editorSceneChannel: channel } : {}),
    };
  };
