import type { ContextExtension, RequirePlugin } from "../gameContext";
import { ecsPlugin } from "../scene/ecsAdapter";
import { spritePlugin } from "../sprite";
import type { Entity } from "../ecs/ecs";
import {
  PositionComponentDefinition,
  type PositionComponent,
} from "../ecs/component";
import {
  ColliderComponentDefinition,
  type ColliderComponent,
} from "../ecs/component";
import {
  VelocityComponentDefinition,
  type VelocityComponent,
} from "../ecs/component";
import { addUpdateCallback, addDrawCallback, isEditorEnabled } from "../gameloop";
import {
  updateCollisionObjects,
  debugDrawColliders,
  type CollisionObject,
  type RectangleCollisionObject,
  type CircleCollisionObject,
} from "../sat";
import { create, add, sub } from "../vector";
import { getViewport } from "../viewport/viewport";

type CollisionObjectWithEntity = CollisionObject & { entityId: Entity };

export function collisionPlugin<
  T extends RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>
>(
  context: T
): ContextExtension<T, {}> {
  // Convert ECS entities to collision objects
  const getCollisionObjects = (): CollisionObjectWithEntity[] => {
    const collisionObjects: CollisionObjectWithEntity[] = [];

    context.ecs.runQuery(
      [
        PositionComponentDefinition,
        ColliderComponentDefinition,
      ],
      (entity, components) => {
        const [position, collider] = components as [
          PositionComponent,
          ColliderComponent
        ];

        if (!collider.collisionEnabled) return;

        const baseCollisionObject: CollisionObject = {
          colliderName: collider.colliderName,
          resolverName: collider.resolverName,
          collisionEnabled: collider.collisionEnabled,
        };

        if (collider.colliderName === "rectangle") {
          const velocity = context.ecs.getComponent(
            entity,
            VelocityComponentDefinition
          );

          const width = collider.width || 32;
          const height = collider.height || 32;
          const offsetX = collider.offsetX || 0;
          const offsetY = collider.offsetY || 0;

          // Entity position is center, but SAT rectangle expects top-left
          // Convert: topLeft = center - (width/2, height/2) + offset
          const entityCenter = create(position.x, position.y);
          const halfSize = create(width / 2, height / 2);
          const offset = create(offsetX, offsetY);
          const topLeft = sub(add(entityCenter, offset), halfSize);

          const rectCollisionObject: RectangleCollisionObject & { entityId: Entity } = {
            ...baseCollisionObject,
            position: topLeft,
            width: width,
            height: height,
            angle: collider.angle || 0,
            velocity: velocity
              ? create(velocity.x, velocity.y)
              : create(0, 0),
            angularVelocity: 0,
            entityId: entity,
          };

          collisionObjects.push(rectCollisionObject);
        } else if (collider.colliderName === "circle") {
          const velocity = context.ecs.getComponent(
            entity,
            VelocityComponentDefinition
          );

          const offsetX = collider.offsetX || 0;
          const offsetY = collider.offsetY || 0;

          // Entity position is center, circle position is also center
          // Just add offset
          const entityCenter = create(position.x, position.y);
          const offset = create(offsetX, offsetY);
          const circleCenter = add(entityCenter, offset);

          const circleCollisionObject: CircleCollisionObject & { entityId: Entity } = {
            ...baseCollisionObject,
            position: circleCenter,
            radius: collider.radius || 16,
            velocity: velocity
              ? create(velocity.x, velocity.y)
              : create(0, 0),
            entityId: entity,
          };

          collisionObjects.push(circleCollisionObject);
        }
      }
    );

    return collisionObjects;
  };

  // Sync collision object changes back to ECS entities
  const syncCollisionObjectsToECS = (
    collisionObjects: CollisionObjectWithEntity[]
  ): void => {
    // Create a map for quick lookup
    const entityMap = new Map<Entity, CollisionObjectWithEntity>();
    for (const collisionObject of collisionObjects) {
      entityMap.set(collisionObject.entityId, collisionObject);
    }

    context.ecs.runQuery(
      [
        PositionComponentDefinition,
        ColliderComponentDefinition,
      ],
      (entity, components) => {
        const [position, collider] = components as [
          PositionComponent,
          ColliderComponent
        ];

        if (!collider.collisionEnabled) return;

        const collisionObject = entityMap.get(entity);
        if (!collisionObject) return;

        // Update position from collision object
        if (collisionObject.colliderName === "rectangle") {
          const width = collider.width || 32;
          const height = collider.height || 32;
          const offsetX = collider.offsetX || 0;
          const offsetY = collider.offsetY || 0;

          // SAT rectangle position is top-left, but entity position is center
          // Convert: center = topLeft + (width/2, height/2) - offset
          const topLeft = collisionObject.position;
          const halfSize = create(width / 2, height / 2);
          const offset = create(offsetX, offsetY);
          const entityCenter = sub(add(topLeft, halfSize), offset);

          position.x = entityCenter[0];
          position.y = entityCenter[1];

          // Update velocity if it exists
          const velocity = context.ecs.getComponent(
            entity,
            VelocityComponentDefinition
          );
          if (velocity && collisionObject.velocity) {
            velocity.x = collisionObject.velocity[0];
            velocity.y = collisionObject.velocity[1];
          }

          // Update angle for rectangles
          if ("angle" in collisionObject) {
            collider.angle = collisionObject.angle;
          }
        } else if (collisionObject.colliderName === "circle") {
          const offsetX = collider.offsetX || 0;
          const offsetY = collider.offsetY || 0;

          // SAT circle position is center, entity position is also center
          // Just subtract offset
          const circleCenter = collisionObject.position;
          const offset = create(offsetX, offsetY);
          const entityCenter = sub(circleCenter, offset);

          position.x = entityCenter[0];
          position.y = entityCenter[1];

          // Update velocity if it exists
          const velocity = context.ecs.getComponent(
            entity,
            VelocityComponentDefinition
          );
          if (velocity && collisionObject.velocity) {
            velocity.x = collisionObject.velocity[0];
            velocity.y = collisionObject.velocity[1];
          }
        }
      }
    );
  };

  // Update collisions in the game loop
  addUpdateCallback(() => {
    const collisionObjects = getCollisionObjects();
    // Remove entityId before passing to SAT system
    const satCollisionObjects = collisionObjects.map(({ entityId, ...obj }) => obj);
    updateCollisionObjects(satCollisionObjects);
    syncCollisionObjectsToECS(collisionObjects);
  });

  // Draw colliders in editor mode
  addDrawCallback(() => {
    if (!isEditorEnabled()) return;

    // Get canvas context from sprite plugin
    const canvas = context.canvas;
    const context2D = context.context2D;

    if (!canvas || !context2D) return;

    const collisionObjects = getCollisionObjects();
    if (collisionObjects.length === 0) return;

    const viewport = getViewport();

    // Save the current context state
    context2D.save();

    // Apply viewport transform
    context2D.scale(viewport.scale, viewport.scale);
    context2D.translate(-viewport.x, -viewport.y);

    // Draw colliders (remove entityId before passing to debug draw)
    const satCollisionObjects = collisionObjects.map(({ entityId, ...obj }) => obj);
    debugDrawColliders(satCollisionObjects, context2D);

    // Restore the context state
    context2D.restore();
  });

  return context;
}

