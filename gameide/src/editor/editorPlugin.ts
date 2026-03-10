import { createSceneTransportPostMessage } from "../sceneChannelTransport.js";
import { createSceneChannel } from "../sceneChannel.js";
import { applyScenePatch } from "../scenePatch.js";
import type { SceneObject } from "../scene.js";
import {
  getScene,
  getRootTarget,
  replaceScene,
  restoreSceneSnapshot,
  subscribeToSceneUpdates,
} from "../scene.js";
import { GameIDEMode, getMode, onModeChange } from "../mode.js";
import { createEditorUI } from "./editorUI.js";

export type ScenePatchMessage = Record<string, unknown>;

export const editorPlugin = () => (input: unknown) => {
  createEditorUI();

  const channel = createSceneChannel({
    transport: createSceneTransportPostMessage({
      target: window.parent,
      source: window,
    }),
    getSceneData: () => structuredClone(getRootTarget() ?? {}),
    setSceneData: (data) => replaceScene(data),
    applyScenePatch,
    subscribeToUpdates: subscribeToSceneUpdates,
  });

  let sceneSnapshot: SceneObject | undefined;

  if (getMode() === GameIDEMode.Editor) {
    const root = getRootTarget() ?? {};
    sceneSnapshot = structuredClone(root);
  }

  onModeChange((mode) => {
    switch (mode) {
      case GameIDEMode.Editor:
        if (sceneSnapshot !== undefined) {
          restoreSceneSnapshot(sceneSnapshot);
          sceneSnapshot = undefined;
        }
        channel.unpause();
        break;

      case GameIDEMode.Game:
        getScene();
        const root = getRootTarget() ?? {};
        sceneSnapshot = structuredClone(root);
        channel.pause();
        break;

      default:
        break;
    }
  });

  return input;
};
