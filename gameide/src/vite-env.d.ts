/// <reference types="vite/client" />

import type { SceneHMRPayload } from "./scene/sceneHMR.js";

declare module "vite/types/customEvent" {
  interface CustomEventMap {
    "gameide:scene-update": SceneHMRPayload;
  }
}
