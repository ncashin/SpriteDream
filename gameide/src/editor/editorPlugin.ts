import { createSceneTransportPostMessage } from "../scene/sceneChannelTransport.js";
import { createSceneChannel } from "../scene/sceneChannel.js";
import { applyScenePatch } from "../scene/scenePatch.js";
import type { SceneObject } from "../scene/scene.js";
import {
  getScene,
  getSceneRaw,
  setScene,
  restoreSceneSnapshot,
  saveSceneSnapshot,
  onSceneChange,
} from "../scene/scene.js";
import { GameIDEMode, getMode, onModeChange } from "../mode.js";
import { createEditorUI } from "./createEditorUI.js";
import type { ComponentType } from "react";
import { DefaultEditor } from "./DefaultEditor.js";

export type ScenePatchMessage = Record<string, unknown>;

export const editorPlugin =
  (Editor?: ComponentType) => async (input: { rootElement: HTMLElement }) => {
   

    const channel = await createSceneChannel({
      transport: createSceneTransportPostMessage({
        target: window.parent,
        source: window,
      }),
      getSceneData: () => getScene(),
      setSceneData: (data) => setScene(data),
      applyScenePatch,
      subscribeToUpdates: onSceneChange,
    });

    const { rootElement } = input;
    createEditorUI(Editor ?? DefaultEditor, rootElement);

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

    return input;
  };
