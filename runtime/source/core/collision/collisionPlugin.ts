import type { ContextExtension, RequirePlugin } from "../gameContext";
import { ecsPlugin } from "../scene/ecsAdapter";
import { spritePlugin } from "../sprite";
import type { Entity, ClickableEntityProvider } from "../ecs/ecs";
import {
  TransformComponentDefinition,
  ColliderComponentDefinition,
  VelocityComponentDefinition,
} from "../ecs/component";
import { addUpdateCallback, addEditorDrawCallback } from "../gameloop";
import { updateCollisions, debugDrawColliders, pointColliderCollision } from "../sat";
import { create } from "../vector";
import { getViewport } from "../viewport/viewportPlugin";
import { getTransform, setTransform } from "../transform";

export function collisionPlugin<
  T extends RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>
>(context: T): ContextExtension<T, { colliderClickProvider: ClickableEntityProvider }> {
  const getCollisionEntities = (): Entity[] => {
    const entities: Entity[] = [];
    context.ecs.runQuery(
      [TransformComponentDefinition, ColliderComponentDefinition],
      (entity, { collider }) => {
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
      (entity, { velocity, collider }) => {
        if (collider.collisionEnabled) {
          const localTransform = getTransform(context.ecs.ecsInstance, entity);
          if (localTransform) {
            const localRotation = localTransform.rotation ?? 0;
            const rotationRad = (localRotation * Math.PI) / 180;
            const cos = Math.cos(rotationRad);
            const sin = Math.sin(rotationRad);

            const rotatedVelX = velocity.x * cos - velocity.y * sin;
            const rotatedVelY = velocity.x * sin + velocity.y * cos;

            const newLocalX = localTransform.x + rotatedVelX * deltaTime;
            const newLocalY = localTransform.y + rotatedVelY * deltaTime;
            setTransform(context.ecs.ecsInstance, entity, { x: newLocalX, y: newLocalY });
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
    const { context2D } = context;

    // Enable anti-aliasing for smooth rendering
    context2D.imageSmoothingEnabled = true;
    context2D.imageSmoothingQuality = "high";

    // Use display dimensions (canvas internal resolution is separate)
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    // Apply DPR transform for high-resolution rendering (same as sprite plugin)
    const dpr = window.devicePixelRatio || 1;
    context2D.setTransform(dpr, 0, 0, dpr, 0, 0);

    context2D.save();
    context2D.translate(displayWidth / 2, displayHeight / 2);
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
        (entity, { transform, collider }) => {
          if (clickedEntity) return;
          if (transform && collider && collider.collisionEnabled) {
            const point = create(worldX, worldY);
            if (pointColliderCollision(context.ecs.ecsInstance, point, entity)) {
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
