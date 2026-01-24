import type { ContextExtension, RequirePlugin } from "../gameContext";
import { ecsPlugin } from "../scene/ecsAdapter";
import { spritePlugin } from "../sprite";
import type { Entity, ClickableEntityProvider } from "../ecs/ecs";
import {
  TransformComponentDefinition,
  ColliderComponentDefinition,
  VelocityComponentDefinition,
  type TransformComponent,
  type ColliderComponent,
} from "../ecs/component";
import { addUpdateCallback, addEditorDrawCallback } from "../gameloop";
import { updateCollisions, debugDrawColliders } from "../sat";
import { getViewport } from "../viewport/viewportPlugin";
import { getWorldPosition, getWorldTransform, setWorldPosition } from "../transform";

export function collisionPlugin<
  T extends RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>
>(context: T): ContextExtension<T, { colliderClickProvider: ClickableEntityProvider }> {
  const getCollisionEntities = (): Entity[] => {
    const entities: Entity[] = [];
    context.ecs.runQuery(
      [TransformComponentDefinition, ColliderComponentDefinition],
      (entity, components) => {
        const [, collider] = components as [
          TransformComponent,
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

    context.ecs.runQuery(
      [
        TransformComponentDefinition,
        VelocityComponentDefinition,
        ColliderComponentDefinition,
      ],
      (entity, [, velocity, collider]) => {
        if (collider.collisionEnabled) {
          // Velocity is in world space, so we need to apply it to world position
          // then convert back to local space
          const currentWorldPos = getWorldPosition(context.ecs.ecsInstance, entity);
          if (currentWorldPos) {
            const newWorldX = currentWorldPos.x + velocity.x * deltaTime;
            const newWorldY = currentWorldPos.y + velocity.y * deltaTime;
            setWorldPosition(context.ecs.ecsInstance, entity, newWorldX, newWorldY);
          }
          collisionEntities.push(entity);
        }
      }
    );

    if (collisionEntities.length > 0) {
      updateCollisions(context.ecs.ecsInstance, collisionEntities);
    }
  });

  addEditorDrawCallback(() => {
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

  const colliderClickProvider: ClickableEntityProvider = {
    checkClick: (worldX: number, worldY: number): string | null => {
      let clickedEntity: string | null = null;

      context.ecs.runQuery(
        [TransformComponentDefinition, ColliderComponentDefinition],
        (entity: Entity, components: [TransformComponent, ColliderComponent]) => {
          if (clickedEntity) return;
          const [transform, collider] = components;
          if (transform && collider && collider.collisionEnabled) {
            const worldPos = getWorldPosition(context.ecs.ecsInstance, entity);
            if (!worldPos) return;

            const worldTransform = getWorldTransform(context.ecs.ecsInstance, entity);
            if (!worldTransform) return;

            const width = collider.width ?? 32;
            const height = collider.height ?? 32;

            // Apply scale to collider dimensions
            const scaledWidth = width * worldTransform.scaleX;
            const scaledHeight = height * worldTransform.scaleY;

            const left = worldPos.x - scaledWidth / 2;
            const right = worldPos.x + scaledWidth / 2;
            const top = worldPos.y - scaledHeight / 2;
            const bottom = worldPos.y + scaledHeight / 2;
            if (
              worldX >= left &&
              worldX <= right &&
              worldY >= top &&
              worldY <= bottom
            ) {
              clickedEntity = entity;
            }
          }
        }
      );

      return clickedEntity;
    },
  };

  return {
    ...context,
    colliderClickProvider,
  };
}
