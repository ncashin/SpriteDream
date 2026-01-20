import type { ResolverDefinition } from "../core/sat";
import { scale } from "../core/vector";
import { registerResolver } from "../core/sat";
import { addStartCallback } from "../core/initialization";
import { addUpdateCallback } from "../core/gameloop";
import type { Component } from "../core/ecs/ecs";
import { defineComponent } from "../core/ecs/component";
import type { RequirePlugin } from "../core/gameContext";
import { ecsPlugin } from "../core/scene/ecsAdapter";
import { inputPlugin } from "../core/input";

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

export function initializePlayer(
  gameContext: RequirePlugin<[typeof ecsPlugin, typeof inputPlugin]>,
  playerEntityId: string = "player"
) {
  const playerEntity = gameContext.ecs.getEntity(playerEntityId);;

  const PLATFORMER_RESOLVER: ResolverDefinition = {
    name: "platformer",
    resolveCollision: (_ecs, entity, other, overlapAmount, overlapNormal) => {
      if (entity === other) return;

      if (entity === playerEntityId && playerEntity) {
        if (!playerEntity.position || !playerEntity.velocity || !playerEntity.collider) return;

        const correction = scale(overlapNormal, overlapAmount);

        playerEntity.position.x += correction[0];
        playerEntity.position.y += correction[1];

        const isVerticalCollision = Math.abs(overlapNormal[0]) < 0.5;
        const isUpwardCorrection = correction[1] < 0;
        const isLandingOnTop = isVerticalCollision && isUpwardCorrection;

        if (playerEntity.velocity.y > 0 && isLandingOnTop) {
          playerEntity.velocity.y = 0;
          if (playerEntity.player) {
            playerEntity.player.isGrounded = true;
          }
        }
      }
    },
  };

  registerResolver(PLATFORMER_RESOLVER);

  addStartCallback(() => {
    playerEntity = gameContext.ecs.getEntity(playerEntityId);
  });

  addUpdateCallback((deltaTime: number) => {
    if (
      !playerEntity ||
      !playerEntity.position ||
      !playerEntity.velocity ||
      !playerEntity.player
    )
      return;

    const player = playerEntity.player;
    const velocity = playerEntity.velocity;
    const speed = player.speed;
    const gravity = player.gravity;
    const jumpStrength = player.jumpStrength;

    if (gameContext.input.isKeyPressed("a")) {
      velocity.x = -speed;
    } else if (gameContext.input.isKeyPressed("d")) {
      velocity.x = speed;
    } else {
      velocity.x *= 0.8;
      if (Math.abs(velocity.x) < 1) {
        velocity.x = 0;
      }
    }

    if (gameContext.input.isKeyPressed(" ") && player.isGrounded) {
      velocity.y = -jumpStrength;
      player.isGrounded = false;
    }

    velocity.y += gravity * deltaTime;
  });
}
