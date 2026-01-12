import type { ResolverDefinition } from "../core/sat";
import { create, sub, scale, dot, normalize } from "../core/vector";
import { registerResolver, addCollisionCallback } from "../core/sat";
import { addStartCallback } from "../core/initialization";
import { addUpdateCallback } from "../core/gameloop";
import { getComponent } from "../core/ecs/ecs";
import {
  PositionComponentDefinition,
  VelocityComponentDefinition,
  ColliderComponentDefinition,
} from "../core/ecs/component";

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
    resolveCollision: (ecs, entity, _other, overlapAmount, overlapNormal) => {
      const position = getComponent(ecs, entity, PositionComponentDefinition);
      const velocity = getComponent(ecs, entity, VelocityComponentDefinition);
      const collider = getComponent(ecs, entity, ColliderComponentDefinition);

      if (!position || !velocity || !collider) return;

      const n = normalize(overlapNormal);

      const correction = scale(n, overlapAmount);
      position.x += correction[0];
      position.y += correction[1];

      const entityVelocity = create(velocity.x, velocity.y);

      const vDotN = dot(entityVelocity, n);

      if (vDotN < 0) {
        const newVelocity = sub(entityVelocity, scale(n, vDotN));
        velocity.x = newVelocity[0];
        velocity.y = newVelocity[1];

        if (n[1] < -0.5) {
          velocity.y = 0;
        }

        if (n[1] > 0.5 && velocity.y > 0) {
          velocity.y = 0;
        }
      }

      if (Math.abs(n[1]) < 0.7) {
        const friction = 0.8;
        velocity.x *= friction;
      }

      const VELOCITY_EPSILON = 1;
      if (Math.abs(velocity.x) < VELOCITY_EPSILON) {
        velocity.x = 0;
      }
      if (Math.abs(velocity.y) < VELOCITY_EPSILON) {
        velocity.y = 0;
      }
    },
  };

  registerResolver(PLATFORMER_RESOLVER);

  addStartCallback(() => {
    playerEntity = gameContext.ecs.getEntity(playerEntityId);

    if (playerEntity.player && playerEntity.player.isGrounded === undefined) {
      playerEntity.player.isGrounded = false;
    }

    addCollisionCallback(
      playerEntityId,
      (_ecs, _entity, _other, _overlapAmount, overlapNormal) => {
        const player = gameContext.ecs.getEntity(playerEntityId);
        if (!player || !player.player) return;

        const n = normalize(overlapNormal);
        if (n[1] > 0.5) {
          player.player.isGrounded = true;
        }
      }
    );
  });

  addUpdateCallback((deltaTime: number) => {
    if (
      !playerEntity ||
      !playerEntity.position ||
      !playerEntity.velocity ||
      !playerEntity.player
    )
      return;

    const speed = playerEntity.player.speed;
    const gravity = playerEntity.player.gravity;
    const jumpStrength = playerEntity.player.jumpStrength;

    playerEntity.player.isGrounded = false;

    if (gameContext.input.isKeyPressed("a")) {
      playerEntity.velocity.x = -speed;
    } else if (gameContext.input.isKeyPressed("d")) {
      playerEntity.velocity.x = speed;
    } else {
      playerEntity.velocity.x *= 0.8;
      if (Math.abs(playerEntity.velocity.x) < 1) {
        playerEntity.velocity.x = 0;
      }
    }

    if (gameContext.input.isKeyPressed(" ") && playerEntity.player.isGrounded) {
      playerEntity.velocity.y = -jumpStrength;
      playerEntity.player.isGrounded = false;
    }

    if (!playerEntity.player.isGrounded) {
      playerEntity.velocity.y += gravity * deltaTime;
    }
  });
}
