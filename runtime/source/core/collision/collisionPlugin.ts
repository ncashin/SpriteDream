import type { ContextExtension, RequirePlugin } from "../gameContext";
import { ecsPlugin } from "../scene/ecsAdapter";
import { spritePlugin } from "../sprite";
import type { Entity, ClickableEntityProvider } from "../ecs/ecs";
import {
  TransformComponentDefinition,
  VelocityComponentDefinition,
} from "../ecs/component";
import { ColliderComponentDefinition } from "./components/colliderComponent";
import { CollisionBodyComponentDefinition } from "./components/collisionBodyComponent";
import { addUpdateCallback, addEditorDrawCallback } from "../gameloop";
import {
  updateCollisions,
  pointColliderCollision,
  getColliderWorldPosition,
  getEntityCollisionColliders,
  getEntityVelocity,
} from "./sat";
import { create } from "../vector";
import { getTransform, setTransform, getWorldTransform } from "../transform";
import { Graphics } from "pixi.js";
import {
  defineCollisionLayers,
  getCollisionLayers,
} from "./collisionLayers";

export function collisionPlugin<
  T extends RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>
>(context: T): ContextExtension<T, {
  colliderClickProvider: ClickableEntityProvider;
  collision: {
    defineLayers: typeof defineCollisionLayers;
    getLayers: typeof getCollisionLayers;
  };
}> {
  const getCollisionEntities = (): Entity[] => {
    const entities: Entity[] = [];
    context.ecs.runQuery(
      [TransformComponentDefinition, ColliderComponentDefinition, CollisionBodyComponentDefinition],
      (entity) => {
        const entityColliders = getEntityCollisionColliders(context.ecs.ecsInstance, entity);
        const hasEnabledCollider = entityColliders.some(({ body }) => body.collisionEnabled);
        if (hasEnabledCollider) {
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
        CollisionBodyComponentDefinition,
      ],
      (entity, { velocity }) => {
        const entityColliders = getEntityCollisionColliders(context.ecs.ecsInstance, entity);
        const hasEnabledCollider = entityColliders.some(({ body }) => body.collisionEnabled);
        if (hasEnabledCollider) {
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

  const colliderGraphicsByEntity = new Map<string, Graphics>();

  const getOrCreateColliderGraphics = (key: string): Graphics => {
    const existing = colliderGraphicsByEntity.get(key);
    if (existing) return existing;
    const graphics = new Graphics();
    colliderGraphicsByEntity.set(key, graphics);
    context.pixiOverlay.addChild(graphics);
    return graphics;
  };

  addEditorDrawCallback(() => {
    if (!context.pixiOverlay || !context.pixiApp || !context.canvas) return;

    const entities = getCollisionEntities();
    if (entities.length === 0) return;

    const seenKeys = new Set<string>();

    for (const entity of entities) {
      const entityColliders = getEntityCollisionColliders(context.ecs.ecsInstance, entity);
      for (let index = 0; index < entityColliders.length; index++) {
        const { body, collider } = entityColliders[index];
        if (!body.collisionEnabled) continue;

        const center = getColliderWorldPosition(context.ecs.ecsInstance, entity, collider);
        if (!center) continue;

        const key = `${entity}:${index}`;
        const graphics = getOrCreateColliderGraphics(key);
        graphics.clear();
        graphics.visible = true;
        seenKeys.add(key);

        if (collider.colliderName === "rectangle") {
          const worldTransform = getWorldTransform(context.ecs.ecsInstance, entity);
          const width = (collider.width ?? 32) * (worldTransform?.scaleX ?? 1);
          const height = (collider.height ?? 32) * (worldTransform?.scaleY ?? 1);
          const colliderAngle = (collider.angle ?? 0) * Math.PI / 180;
          const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
          const totalAngle = colliderAngle + transformAngle;

          graphics.position.set(center[0], center[1]);
          graphics.rotation = totalAngle;
          graphics.rect(-width / 2, -height / 2, width, height).stroke({
            color: 0xff0000,
            width: 2,
          });
        } else if (collider.colliderName === "circle") {
          const worldTransform = getWorldTransform(context.ecs.ecsInstance, entity);
          const baseRadius = collider.radius ?? 16;
          const scale = worldTransform ? Math.max(worldTransform.scaleX, worldTransform.scaleY) : 1;
          const radius = baseRadius * scale;
          const velocity = getEntityVelocity(context.ecs.ecsInstance, entity);

          graphics.position.set(center[0], center[1]);
          graphics.rotation = 0;
          graphics.circle(0, 0, radius).stroke({ color: 0xff0000, width: 2 });

          if (velocity) {
            const scaleFactor = 0.1;
            graphics.moveTo(0, 0);
            graphics.lineTo(velocity[0] * scaleFactor, velocity[1] * scaleFactor);
            graphics.stroke({ color: 0x00ff00, width: 2 });
          }
        }
      }
    }

    for (const [entity, graphics] of colliderGraphicsByEntity.entries()) {
      if (seenKeys.has(entity)) continue;
      context.pixiOverlay.removeChild(graphics);
      graphics.destroy();
      colliderGraphicsByEntity.delete(entity);
    }
  });

  const colliderClickProvider: ClickableEntityProvider = {
    checkClick: (worldX: number, worldY: number): string | null => {
      let clickedEntity: string | null = null;

      context.ecs.runQuery(
        [TransformComponentDefinition, ColliderComponentDefinition, CollisionBodyComponentDefinition],
        (entity, { transform, collisionBody }) => {
          if (clickedEntity) return;
          if (transform && collisionBody && collisionBody.collisionEnabled) {
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
    collision: {
      defineLayers: defineCollisionLayers,
      getLayers: getCollisionLayers,
    },
  };
}
