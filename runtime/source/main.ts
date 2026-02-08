import { initializeGame, type GameContext as GameContextType } from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import { spritePlugin } from "./core/sprite";
import { inputPlugin } from "./core/input";
import { viewportPlugin } from "./core/viewport/viewportPlugin";
import { collisionPlugin } from "./core/collision/collisionPlugin";
import { ecsEditorPlugin } from "./core/ecs/editor/ECSEditorPlugin";
import { sceneGraphPlugin } from "./core/sceneGraph/sceneGraphPlugin";
import { sceneEntityPlugin } from "./core/scene/sceneEntity";
import {
  addUpdateCallback,
} from "./core/gameloop";
import { type Component } from "./core/ecs/ecs";
import { defineComponent, VelocityComponentDefinition, TransformComponentDefinition } from "./core/ecs/component";
import { registerCollisionCallback } from "./core/collision/collisionCallbacks";
import { screenToWorld } from "./core/viewport/viewportPlugin";
import { loadScene } from "./core/scene/loadScene";

import { EditorUI } from "./EditorUI";
import { GameUI } from "./GameUI";



export type PlayerComponent = Component & {
  type: "playerComponent";
  speed: number;
  gravity: number;
  jumpStrength: number;
  isGrounded: boolean;
};

export const PlayerComponentDefinition: PlayerComponent = defineComponent(
  {
    type: "playerComponent",
    speed: 0,
    gravity: 0,
    jumpStrength: 0,
    isGrounded: false,
  },
  {
    displayName: "Player",
    description: "Player Controlled Entity",
  }
);

export type FireballComponent = Component & {
  type: "fireball";
  timeToLive: number;
};

export const FireballComponentDefinition: FireballComponent = defineComponent(
  {
    type: "fireball",
    timeToLive: 2,
  },
  {
    displayName: "Fireball",
    description: "Player Fireball Projectile",
  }
);


const plugins = [
  inputPlugin,
  viewportPlugin,
  ecsPlugin,
  sceneGraphPlugin,
  sceneEntityPlugin,
  spritePlugin,
  collisionPlugin,
  ecsEditorPlugin,
] as const;

type GameContext = GameContextType<typeof plugins>;

initializeGame({
  plugins,
  initialScene: loadScene("default"),
  main,
  EditorUI,
  GameUI,
});

function main({ ecs, input, sceneGraph, collision }: GameContext) {
  collision.defineLayers(["Player", "Projectile", "World"]);
  const playerEntityId = "player";

  let timeSinceLastShot = 0;
  const timeBetweenShots = 0.25;

  const playerEntity = ecs.getEntity(playerEntityId, [PlayerComponentDefinition, VelocityComponentDefinition]);
  if (!playerEntity) {
    return;
  }

  addUpdateCallback((deltaTime: number) => {
    const { speed, jumpStrength, gravity } = playerEntity.playerComponent;

    const movingLeft = input.isKeyPressed("a");
    const movingRight = input.isKeyPressed("d");

    if (movingLeft) {
      playerEntity.velocity.x = -speed;
    }

    if (movingRight) {
      playerEntity.velocity.x = speed;
    }

    if (!movingLeft && !movingRight) {
      playerEntity.velocity.x *= 0.8;
      if (Math.abs(playerEntity.velocity.x) < 1) {
        playerEntity.velocity.x = 0;
      }
    }

    playerEntity.velocity.y += gravity * deltaTime;

    if (input.isKeyPressed(" ") && playerEntity.playerComponent.isGrounded) {
      playerEntity.velocity.y = -jumpStrength;
      playerEntity.playerComponent.isGrounded = false;
    }


  });

  addUpdateCallback((deltaTime) => {
    timeSinceLastShot += deltaTime;

    const leftMousePressed = input.isMouseButtonPressed("left");
    if (!leftMousePressed || timeSinceLastShot < timeBetweenShots) {
      return;
    }

    const mousePos = input.getMousePosition();
    const worldPos = screenToWorld(mousePos.x, mousePos.y);
    const playerWorldPos = sceneGraph.getWorldPosition(playerEntity);
    if (!playerWorldPos) {
      return;
    }

    const dx = worldPos.x - playerWorldPos.x;
    const dy = worldPos.y - playerWorldPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= 0) {
      return;
    }

    const fireballSpeed = 500;
    const velocityX = (dx / distance) * fireballSpeed;
    const velocityY = (dy / distance) * fireballSpeed;


    const fireballScene = loadScene("fireball");
    const newFireball = ecs.instantiateSceneEntity(fireballScene);
    if (!newFireball) {
      return;
    }

    const hasRequiredComponents = ecs.hasComponents(
      newFireball,
      [TransformComponentDefinition, VelocityComponentDefinition],
    );
    if (!hasRequiredComponents) {
      return;
    }

    newFireball.transform.x = playerWorldPos.x;
    newFireball.transform.y = playerWorldPos.y;

    newFireball.velocity.x = velocityX;
    newFireball.velocity.y = velocityY;

    timeSinceLastShot = 0;
  })

  addUpdateCallback((deltaTime) => {
    ecs.runQuery([FireballComponentDefinition], (entity, { fireball }) => {
      fireball.timeToLive -= deltaTime;
      if (fireball.timeToLive <= 0) {
        ecs.destroyEntity(entity);
      }
    });
  });

  registerCollisionCallback({
    name: "Player",
    callback: ({ entity, overlapNormal }) => {
      const hasRequiredComponents = ecs.hasComponents(entity, [PlayerComponentDefinition, VelocityComponentDefinition]);
      if (!hasRequiredComponents) {
        return;
      }

      const isVerticalCollision = Math.abs(overlapNormal[0]) < 0.5;
      const isNormalPointingUp = overlapNormal[1] < 0;
      const isNormalPointingDown = overlapNormal[1] > 0;
      const isLandingOnTop = isVerticalCollision && isNormalPointingUp;
      const isHittingHead = isVerticalCollision && isNormalPointingDown;

      if (entity.velocity.y > 0 && isLandingOnTop) {
        entity.velocity.y = 0;
        entity.playerComponent.isGrounded = true;
      }

      if (entity.velocity.y < 0 && isHittingHead) {
        entity.velocity.y = 0;
      }
    },
  });

  registerCollisionCallback({
    name: "Fireball",
    callback: ({ entity }) => {
      ecs.destroyEntity(entity);
    },
  });
}


