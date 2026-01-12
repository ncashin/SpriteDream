import type { ResolverDefinition, RectangleCollisionObject } from "../core/sat";
import { create, add, sub, scale, dot, normalize } from "../core/vector";
import { registerResolver } from "../core/sat";
import { addStartCallback } from "../core/initialization";
import { addUpdateCallback } from "../core/gameloop";

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

  // Create resolver that accesses the actual player entity's velocity
  const PLATFORMER_RESOLVER: ResolverDefinition<RectangleCollisionObject> = {
    name: "platformer",
    resolveCollision: (objA, _objB, overlapAmount, overlapNormal) => {
      const n = normalize(overlapNormal);
      objA.position = add(objA.position, scale(n, overlapAmount));

      // Use the actual player entity's velocity instead of collision object's velocity
      if (!playerEntity || !playerEntity.velocity) {
        return;
      }

      // Convert entity velocity to vector format for calculations
      const entityVelocity = create(
        playerEntity.velocity.x,
        playerEntity.velocity.y
      );

      const vDotN = dot(entityVelocity, n);

      // Only resolve collision if moving into the surface (vDotN < 0)
      // This allows jumping (moving away from surface) to work
      if (vDotN < 0) {
        const newVelocity = sub(entityVelocity, scale(n, vDotN));
        playerEntity.velocity.x = newVelocity[0];
        playerEntity.velocity.y = newVelocity[1];

        // If landing on top of something (normal pointing up), zero y velocity
        // This prevents velocity accumulation and ensures proper grounding
        if (n[1] < -0.5) {
          playerEntity.velocity.y = 0;
        }

        // If colliding from above (normal pointing down), also zero y velocity
        // This prevents the player from falling through when already on top
        if (n[1] > 0.5 && playerEntity.velocity.y > 0) {
          playerEntity.velocity.y = 0;
        }
      }

      if (Math.abs(n[1]) < 0.7) {
        const friction = 0.8;
        playerEntity.velocity.x *= friction;
      }

      const VELOCITY_EPSILON = 1;
      if (Math.abs(playerEntity.velocity.x) < VELOCITY_EPSILON) {
        playerEntity.velocity.x = 0;
      }
      if (Math.abs(playerEntity.velocity.y) < VELOCITY_EPSILON) {
        playerEntity.velocity.y = 0;
      }

      // Sync back to collision object for position updates
      if (!objA.velocity) {
        objA.velocity = create(0, 0);
      }
      objA.velocity = create(playerEntity.velocity.x, playerEntity.velocity.y);
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

    const speed = playerEntity.player.speed;
    const gravity = playerEntity.player.gravity;
    const jumpStrength = playerEntity.player.jumpStrength;

    // Check if grounded - velocity.y should be 0 or very small after collision resolution
    // The collision system runs before this callback, so velocity.y should already be resolved
    playerEntity.player.isGrounded = Math.abs(playerEntity.velocity.y) < 0.1;

    // Handle horizontal movement via velocity
    if (gameContext.input.isKeyPressed("a")) {
      playerEntity.velocity.x = -speed;
    } else if (gameContext.input.isKeyPressed("d")) {
      playerEntity.velocity.x = speed;
    } else {
      // Apply friction when no input
      playerEntity.velocity.x *= 0.8;
      if (Math.abs(playerEntity.velocity.x) < 1) {
        playerEntity.velocity.x = 0;
      }
    }

    // Handle jumping
    if (gameContext.input.isKeyPressed(" ") && playerEntity.player.isGrounded) {
      playerEntity.velocity.y = -jumpStrength;
      playerEntity.player.isGrounded = false;
    }

    // Apply gravity only when not grounded
    // When grounded, the resolver will keep y velocity at 0, so we don't want to add gravity
    if (!playerEntity.player.isGrounded) {
      playerEntity.velocity.y += gravity * deltaTime;
    }

    // Don't update position here - let the collision system handle it
    // The collision system will integrate velocity and resolve collisions
  });
}
