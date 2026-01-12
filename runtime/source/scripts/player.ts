import type { ResolverDefinition } from "../core/sat";
import { create, sub, scale, dot, normalize } from "../core/vector";
import { registerResolver } from "../core/sat";
import { addStartCallback } from "../core/initialization";
import { addUpdateCallback } from "../core/gameloop";
import { getComponent, type Component } from "../core/ecs/ecs";
import {
  PositionComponentDefinition,
  VelocityComponentDefinition,
  ColliderComponentDefinition,
  defineComponent,
} from "../core/ecs/component";

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
    description: "Player-controlled entity",
  }
);

export function initializePlayer(
  gameContext: {
    ecs: ReturnType<typeof import("../core/ecs/ecs").curryECSInstance>;
    input: {
      isKeyPressed: (key: string) => boolean;
      isKeyDown: (key: string) => boolean;
      isKeyUp: (key: string) => boolean;
      getMousePosition: () => { x: number; y: number };
      isMouseButtonPressed: (button: "left" | "middle" | "right") => boolean;
      getState: () => any;
      getDragState: () => any;
      startDrag: (x: number, y: number) => void;
      updateDrag: (x: number, y: number) => void;
      endDrag: () => void;
    };
  },
  playerEntityId: string = "player"
) {
  let playerEntity: any | null = null;

  const PLATFORMER_RESOLVER: ResolverDefinition = {
    name: "platformer",
    resolveCollision: (ecs, entity, other, overlapAmount, overlapNormal) => {
      if (entity === other) return;
      const isPlayer = playerEntity && entity === playerEntityId;
      const position = isPlayer
        ? playerEntity.position
        : getComponent(ecs, entity, PositionComponentDefinition);
      const velocity = isPlayer
        ? playerEntity.velocity
        : getComponent(ecs, entity, VelocityComponentDefinition);
      const collider = isPlayer
        ? playerEntity.collider
        : getComponent(ecs, entity, ColliderComponentDefinition);
      const player = isPlayer
        ? playerEntity.player
        : getComponent(ecs, entity, PlayerComponentDefinition);

      if (!position || !velocity || !collider) return;

      const correction = scale(overlapNormal, overlapAmount);

      position.x += correction[0];
      position.y += correction[1];

      if (velocity.y > 0) {
        velocity.y = 0;
        player.isGrounded = true;
      }
    },
  };

  registerResolver(PLATFORMER_RESOLVER);

  addStartCallback(() => {
    playerEntity = gameContext.ecs.getEntity(playerEntityId);

    if (playerEntity.player && playerEntity.player.isGrounded === undefined) {
      playerEntity.player.isGrounded = false;
    }
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

    if (!player.isGrounded) {
      velocity.y += gravity * deltaTime;
    } else {
      velocity.y = 0;
    }
  });
}
