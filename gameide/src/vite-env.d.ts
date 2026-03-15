/// <reference types="vite/client" />

import type { SceneHMRPayload } from "./sceneHMR.js";

declare module "vite/types/customEvent" {
  interface CustomEventMap {
    "gameide:scene-update": SceneHMRPayload;
  }
}
