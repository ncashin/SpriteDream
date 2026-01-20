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
  registerResolver(
    {
      name: "player",
      resolveCollision: (_ecs, entity, other, overlapAmount, overlapNormal) => {
        if (entity === other) {
          return;
        }

        const playerEntity = gameContext.ecs.getEntity(entity);
        if (
          !playerEntity ||
          !playerEntity.position ||
          !playerEntity.velocity ||
          !playerEntity.collider
        )
          return;


        const correction = scale(overlapNormal, overlapAmount);

        playerEntity.position.x += correction[0];
        playerEntity.position.y += correction[1];

        const isVerticalCollision = Math.abs(overlapNormal[0]) < 0.5;
        const isUpwardCorrection = correction[1] < 0;
        const isLandingOnTop = isVerticalCollision && isUpwardCorrection;

        if (playerEntity.velocity.y <= 0 || !isLandingOnTop)
          return;

        playerEntity.velocity.y = 0;
        playerEntity.player.isGrounded = true;
      },
    });

  addUpdateCallback((deltaTime: number) => {
    const playerEntity = gameContext.ecs.getEntity(playerEntityId);
    if (!playerEntity || !playerEntity.player || !playerEntity.velocity) return;

    const { input } = gameContext;
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



    // Gravity
    playerEntity.velocity.y += gravity * deltaTime;

    // Jumping
    if (input.isKeyPressed(" ") && playerEntity.player.isGrounded) return;

    playerEntity.velocity.y = -jumpStrength;
    playerEntity.player.isGrounded = false;

  });
}