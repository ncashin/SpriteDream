import type { SceneObjectData } from "./scene.js";

export const SCENE_HMR_EVENT_NAME = "gameide:scene-update" as const;

export type SceneHMRPayload = {
  path: string;
  sceneData: SceneObjectData;
};
