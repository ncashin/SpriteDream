import type { ContextExtension, RequirePlugin, ClickableEntityProvider } from "../gameContext";
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
import { addUpdateCallback, addEditorUpdateCallback } from "../gameloop";
import { updateCollisions, debugDrawColliders } from "../sat";
import { getViewport } from "../viewport/viewportPlugin";

export function collisionPlugin<
  T extends RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>
>(context: T): ContextExtension<T, { colliderClickProvider: ClickableEntityProvider }> {
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

    context.ecs.runQuery(
      [
        PositionComponentDefinition,
        VelocityComponentDefinition,
        ColliderComponentDefinition,
      ],
      (entity, [position, velocity, collider]) => {
        if (collider.collisionEnabled) {
          position.x += velocity.x * deltaTime;
          position.y += velocity.y * deltaTime;
          collisionEntities.push(entity);
        }
      }
    );

    if (collisionEntities.length > 0) {
      updateCollisions(context.ecs.ecsInstance, collisionEntities);
    }
  });

  addEditorUpdateCallback(() => {
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
        [PositionComponentDefinition, ColliderComponentDefinition],
        (entity: Entity, components: [PositionComponent, ColliderComponent]) => {
          if (clickedEntity) return;
          const [position, collider] = components;
          if (position && collider && collider.collisionEnabled) {
            const width = collider.width ?? 32;
            const height = collider.height ?? 32;
            const offsetX = collider.offsetX ?? 0;
            const offsetY = collider.offsetY ?? 0;
            const left = position.x + offsetX - width / 2;
            const right = position.x + offsetX + width / 2;
            const top = position.y + offsetY - height / 2;
            const bottom = position.y + offsetY + height / 2;
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
