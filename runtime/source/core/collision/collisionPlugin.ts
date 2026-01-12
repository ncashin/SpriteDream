import type { ContextExtension, RequirePlugin } from "../gameContext";
import { ecsPlugin } from "../scene/ecsAdapter";
import { spritePlugin } from "../sprite";
import type { Entity } from "../ecs/ecs";
import {
  PositionComponentDefinition,
  ColliderComponentDefinition,
  VelocityComponentDefinition,
  type PositionComponent,
  type ColliderComponent,
} from "../ecs/component";
import { addUpdateCallback, addEditorCallback } from "../gameloop";
import { updateCollisions, debugDrawColliders } from "../sat";
import { getViewport } from "../viewport/viewport";

export function collisionPlugin<
  T extends RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>
>(context: T): ContextExtension<T, {}> {
  // Helper for editor callback (doesn't need velocity)
  const getCollisionEntities = (): Entity[] => {
    const entities: Entity[] = [];
    context.ecs.runQuery(
      [PositionComponentDefinition, ColliderComponentDefinition],
      (entity, components) => {
        const [, collider] = components as [
          PositionComponent,
          ColliderComponent
        ];
        if (collider.collisionEnabled) {
          entities.push(entity);
        }
      }
    );
    return entities;
  };

  addUpdateCallback((deltaTime: number) => {
    const collisionEntities: Entity[] = [];

    // Single query: apply velocity to position and collect collision entities
    // This ensures position is updated once before collision detection
    context.ecs.runQuery(
      [
        PositionComponentDefinition,
        VelocityComponentDefinition,
        ColliderComponentDefinition,
      ],
      (entity, [position, velocity, collider]) => {
        if (collider.collisionEnabled) {
          // Apply velocity to position (only once per frame)
          position.x += velocity.x * deltaTime;
          position.y += velocity.y * deltaTime;
          // Collect entity for collision checking
          collisionEntities.push(entity);
        }
      }
    );

    // Check collisions and call resolver callbacks (e.g., platformer resolver from player.ts)
    if (collisionEntities.length > 0) {
      updateCollisions(context.ecs.ecsInstance, collisionEntities);
    }
  });

  addEditorCallback(() => {
    if (!context.canvas || !context.context2D) return;

    const entities = getCollisionEntities();
    if (entities.length === 0) return;

    const viewport = getViewport();
    const { canvas, context2D } = context;

    context2D.save();
    context2D.translate(canvas.width / 2, canvas.height / 2);
    context2D.scale(viewport.scale, viewport.scale);
    context2D.translate(-viewport.x, -viewport.y);
    debugDrawColliders(context.ecs.ecsInstance, entities, context2D);
    context2D.restore();
  });

  return context;
}
