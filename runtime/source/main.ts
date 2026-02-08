import { initializeGame, type AccumulatePluginResults } from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import { spritePlugin } from "./core/sprite";
import { inputPlugin } from "./core/input";
import { viewportPlugin } from "./core/viewport/viewportPlugin";
import { collisionPlugin } from "./core/collision/collisionPlugin";
import { ecsEditorPlugin } from "./core/ecs/editor/ECSEditorPlugin";
import { sceneGraphPlugin } from "./core/sceneGraph/sceneGraphPlugin";
import {
  addUpdateCallback,
} from "./core/gameloop";
import { type Component } from "./core/ecs/ecs";
import { defineComponent, VelocityComponentDefinition, TransformComponentDefinition } from "./core/ecs/component";
import { ColliderComponentDefinition } from "./core/collision/components/colliderComponent";
import { CollisionBodyComponentDefinition } from "./core/collision/components/collisionBodyComponent";
import { SpriteComponentDefinition } from "./core/sprite";
import { registerCollisionCallback } from "./core/collision/collisionCallbacks";
import { screenToWorld } from "./core/viewport/viewportPlugin";
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
    description: "Fireball lifetime tracking",
  }
);


const plugins = [
  inputPlugin,
  viewportPlugin,
  ecsPlugin,
  sceneGraphPlugin,
  spritePlugin,
  collisionPlugin,
  ecsEditorPlugin,
] as const;

type GameContext = AccumulatePluginResults<typeof plugins>;

initializeGame({
  plugins,
  initialScene,
  main,
  EditorUI,
  GameUI,
});

const playerEntityId = "player";

function main({ ecs, input, sceneGraph }: GameContext) {
  let timeSinceLastShot = 0;
  const timeBetweenShots = 0.25;

  const playerEntity = ecs.getEntity(playerEntityId, [PlayerComponentDefinition, VelocityComponentDefinition]);

  addUpdateCallback((deltaTime: number) => {
    if (!playerEntity) {
      return;
    }

    const { speed, jumpStrength, gravity } = playerEntity.player;

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

    if (input.isKeyPressed(" ") && playerEntity.player.isGrounded) {
      playerEntity.velocity.y = -jumpStrength;
      playerEntity.player.isGrounded = false;
    }

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

    const fireballEntity = ecs.createEntity("fireball");

    ecs.addComponent(fireballEntity, TransformComponentDefinition, {
      x: playerWorldPos.x,
      y: playerWorldPos.y,
    });
    ecs.addComponent(fireballEntity, SpriteComponentDefinition, {
      width: 24,
      height: 24,
      image: "/fireball.png",
    });
    ecs.addComponent(fireballEntity, VelocityComponentDefinition, {
      x: velocityX,
      y: velocityY,
    });
    ecs.addComponent(fireballEntity, FireballComponentDefinition, {
      timeToLive: 2,
    });
    ecs.addComponent(fireballEntity, CollisionBodyComponentDefinition, {
      bodyType: "trigger",
      collisionEnabled: true,
      collisionCallback: "Fireball Collision Callback",
    });
    ecs.addComponent(fireballEntity, ColliderComponentDefinition, {
      colliderName: "circle",
      radius: 12,
    });

    timeSinceLastShot = 0;
  });

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
        entity.player.isGrounded = true;
      }

      if (entity.velocity.y < 0 && isHittingHead) {
        entity.velocity.y = 0;
      }
    },
  });

  registerCollisionCallback({
    name: "Fireball Collision Callback",
    callback: ({ entity }) => {
      ecs.destroyEntity(entity);
    },
  });
}


