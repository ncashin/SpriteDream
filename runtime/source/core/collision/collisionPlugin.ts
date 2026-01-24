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
          // Velocity is in local space, so we need to rotate it by the entity's local rotation
          // before applying it to local position
          const localTransform = getTransform(context.ecs.ecsInstance, entity);
          if (localTransform) {
            // Get the entity's local rotation (in degrees)
            const localRotation = localTransform.rotation ?? 0;
            const rotationRad = (localRotation * Math.PI) / 180;
            const cos = Math.cos(rotationRad);
            const sin = Math.sin(rotationRad);

            // Rotate the velocity vector by the entity's local rotation
            const rotatedVelX = velocity.x * cos - velocity.y * sin;
            const rotatedVelY = velocity.x * sin + velocity.y * cos;

            // Apply the rotated velocity to local position
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
