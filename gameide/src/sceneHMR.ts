import type { SceneObject } from "./scene.js";

export const SCENE_HMR_EVENT_NAME = "gameide:scene-update" as const;

export type SceneHMRPayload = {
  path: string;
  previousSceneData?: SceneObject;
  sceneData: SceneObject;
};
