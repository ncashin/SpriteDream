import {
  initializeGameContext as initializeGameContext,
  type InitialGameContext,
} from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import { spritePlugin } from "./core/sprite";
import { inputPlugin } from "./core/input";
import { viewportPlugin } from "./core/viewport/viewportPlugin";
import { collisionPlugin } from "./core/collision/collisionPlugin";
import { ecsEditorPlugin } from "./core/ecs/editor/ECSEditorPlugin";
import { initializePlayer } from "./scripts/main";
import "./scripts/weapon";
import initialScene from "../scenes/default.scene?raw";
import { defineMainFunction } from "./core/runtimeWrapper.ts";

export {
  getViewport,
  setViewport,
  updateViewport,
  resetViewport,
  setViewportScale,
  zoomViewport,
} from "./core/viewport/viewportPlugin";

export function main(initialContext: InitialGameContext) {
  const gameContext = initializeGameContext({
    initialContext,
    plugins: [
      inputPlugin,
      viewportPlugin,
      ecsPlugin,
      spritePlugin,
      collisionPlugin,
      ecsEditorPlugin,
    ],
    initialScene,
  });

  initializePlayer(gameContext, "player");
}

defineMainFunction(main);
