import { createSceneTransportPostMessage } from "../../scene/sceneChannel/sceneChannelTransport.js";
import { getDevSceneChannelTransport } from "../../scene/sceneChannel/sceneChannelDevTransport.js";
import { createSceneChannel } from "../../scene/sceneChannel/sceneChannel.js";
import type { SceneChannel } from "../../scene/sceneChannel/sceneChannel.js";
import { GameIDEMode, getMode, onModeChange } from "../../lifecycle/mode.js";
import type { GameContext } from "../../lifecycle/initialization.js";
import { createEditorUI } from "./createEditorUI.js";
import type { EditorWithGameViewReference } from "./createEditorUI.js";
import { restoreSceneSnapshot, saveSceneSnapshot } from "../../scene/snapshot.js";

function preferredScenePathFromUrl(): string | undefined {
  const fromQuery = new URL(window.location.href).searchParams.get("scene") ?? "";
  return fromQuery || undefined;
}

export const editorPlugin =
  (Editor: EditorWithGameViewReference) =>
  async (input: GameContext<object>) => {
    if (process.env.NODE_ENV !== "development") {
      return input;
    }

    const embeddedInParentIFrame = window && window.parent !== window;
    const transport = embeddedInParentIFrame
      ? createSceneTransportPostMessage({
          target: window.parent,
          source: window,
        })
      : getDevSceneChannelTransport();

    const channel = await createSceneChannel({
      transport,
      scene: input.scene,
      initializeScene: true,
      initialScenePath: embeddedInParentIFrame
        ? undefined
        : preferredScenePathFromUrl(),
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

    const mount = await createEditorUI(input.rootElement, Editor);

    input.dispose(() => {
      releaseModeWatcher();
      channel.dispose();
      mount.dispose();
    });

    return {
      ...input,
      initialScene: structuredClone(input.scene.getRaw()),
      rootElement: mount.gameViewRoot,
      editorSceneChannel: channel,
    };
  };
