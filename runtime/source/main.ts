import { initializeGame, type AccumulatePluginResults } from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import { spritePlugin } from "./core/sprite";
import { inputPlugin } from "./core/input";
import { viewportPlugin } from "./core/viewport/viewportPlugin";
import { collisionPlugin } from "./core/collision/collisionPlugin";
import { ecsEditorPlugin } from "./core/ecs/editor/ECSEditorPlugin";
import {
  addUpdateCallback,
} from "./core/gameloop";
import type { Component } from "./core/ecs/ecs";
import { getEntity } from "./core/ecs/ecs";
import { defineComponent, VelocityComponentDefinition } from "./core/ecs/component";
import { registerCollisionCallback } from "./core/collision/collisionCallbacks";
import initialScene from "../scenes/default.scene?raw";

import { EditorUI } from "./EditorUI";
import { GameUI } from "./GameUI";

export {
  getViewport,
  setViewport,
  updateViewport,
  resetViewport,
  setViewportScale,
  zoomViewport,
} from "./core/viewport/viewportPlugin";

const plugins = [
  inputPlugin,
  viewportPlugin,
  ecsPlugin,
  spritePlugin,
  collisionPlugin,
  ecsEditorPlugin,
] as const;

type GameContext = AccumulatePluginResults<typeof plugins>;

export type PlayerComponent = Component & {
  type: "player";
  speed: number;
  gravity: number;
  jumpStrength: number;
  isGrounded: boolean;
};

export const PlayerComponentDefinition: PlayerComponent = defineComponent(
  {
    type: "player",
    speed: 0,
    gravity: 0,
    jumpStrength: 0,
    isGrounded: false,
  },
  {
    displayName: "Player",
    description: "Player controlled entity",
  }
);

export const SceneEntity = defineComponent(
  {
    type: "player",
    sceneFile: "",
  },
  {
    displayName: "Scene Entity",
    description: "It do Scene Entity Things",
  }
);



initializeGame({
  plugins,
  initialScene,
  main,
  EditorUI,
  GameUI,
});

function main({ ecs, input }: GameContext) {
  addUpdateCallback((deltaTime: number) => {
    const playerEntityId = "player";
    const playerEntity = ecs.getEntity(playerEntityId, [PlayerComponentDefinition, VelocityComponentDefinition]);
    if (!playerEntity) {
      return;
    }
    const { speed, jumpStrength, gravity } = playerEntity.player;

    if (input.isKeyPressed("a")) {
      playerEntity.velocity.x = -speed;
    } else if (input.isKeyPressed("d")) {
      playerEntity.velocity.x = speed;
    } else {
      playerEntity.velocity.x *= 0.8;
      if (Math.abs(playerEntity.velocity.x) < 1) {
        playerEntity.velocity.x = 0;
      }
    }

    playerEntity.velocity.y += gravity * deltaTime;

    if (input.isKeyPressed(" ") && playerEntity.player.isGrounded) {
      playerEntity.velocity.y = -jumpStrength;
      playerEntity.player.isGrounded = false;
    }
  });

  registerCollisionCallback({
    name: "player",
    callback: (_ecs, entity, _other, _overlapAmount, overlapNormal) => {
      const entityData = ecs.getEntity(entity);
      if (!ecs.hasComponents(entityData, [PlayerComponentDefinition, VelocityComponentDefinition])) {
        return;
      }

      const velocity = getEntity(_ecs, entity)[VelocityComponentDefinition.type] as typeof VelocityComponentDefinition;

      const isVerticalCollision = Math.abs(overlapNormal[0]) < 0.5;
      const isNormalPointingUp = overlapNormal[1] < 0;
      const isNormalPointingDown = overlapNormal[1] > 0;
      const isLandingOnTop = isVerticalCollision && isNormalPointingUp;
      const isHittingHead = isVerticalCollision && isNormalPointingDown;

      if (velocity.y > 0 && isLandingOnTop) {
        velocity.y = 0;
        entityData.player.isGrounded = true;
      }

      if (velocity.y < 0 && isHittingHead) {
        velocity.y = 0;
      }
    },
  });
}


