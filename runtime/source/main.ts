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
import { addStartCallback } from "./core/initialization";
import { initializePlayer } from "./scripts/player";
import "./scripts/weapon";
import { initializeWeapon } from "./scripts/weapon";
import { initializeProjectile } from "./scripts/projectile";
import { initializeBoss } from "./scripts/boss";
import { initializeDamageNumber } from "./scripts/damageNumber";
import type { Component } from "./core/ecs/ecs";
import { defineComponent } from "./core/ecs/component";
import initialScene from "../scenes/default.scene?raw";
import { defineMainFunction } from "./core/runtimeWrapper.ts";
import { getScene } from "./core/scene/scene.ts";

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
