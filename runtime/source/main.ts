import {
  initializeGameContext as initializeGameContext,
  type InitialGameContext,
} from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import { spritePlugin } from "./core/sprite";
import { inputPlugin } from "./core/input";
import { viewportPlugin } from "./core/viewport/viewportPlugin";
import { collisionPlugin } from "./core/collision/collisionPlugin";
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

export {
  getViewport,
  setViewport,
  updateViewport,
  resetViewport,
  setViewportScale,
  zoomViewport,
} from "./core/viewport/viewportPlugin";

export type PlatformComponent = Component & {
  type: "platform";
};
export const PlatformComponentDefinition: PlatformComponent = defineComponent(
  {
    type: "platform",
  },
  {
    displayName: "Platform",
    description: "A platform entity",
  }
);


export function main(initialContext: InitialGameContext) {
  const gameContext = initializeGameContext({
    initialContext,
    plugins: [
      ecsPlugin,
      spritePlugin,
      collisionPlugin,
      inputPlugin,
      viewportPlugin,
    ],
    initialScene,
  });

  initializePlayer(gameContext, "player");
  initializeWeapon(gameContext);
  initializeProjectile(gameContext);
  initializeBoss(gameContext);
  initializeDamageNumber(gameContext);

  addStartCallback(() => {
    const component = document.createElement("div");
    component.textContent = "Game started!";
    gameContext.rootElement.appendChild(component);
  });
}

defineMainFunction(main);
