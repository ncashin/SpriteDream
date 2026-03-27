import Matter from "matter-js";
import { definePlugin } from "../plugin.js";
import { createObjectGuard } from "../objectRegistry.js";
import type { SchemaToType } from "../objectRegistry.js";
import { TransformDefinition2D } from "../renderPlugin2D/transform.js";
import { getScene } from "../scene.js";
import { gameUpdate } from "../gameloop.js";
import { createCallbackRegistry } from "../callbackRegistry.js";
import type { SceneObject } from "../scene.js";
import { collider2D } from "./collider2D.js";
import { collisionBody2D } from "./collisionBody2D.js";

export type Collision2DEvent = {
  a: SceneObject;
  b: SceneObject;
  bodyA: Matter.Body;
  bodyB: Matter.Body;
  pair: Matter.Pair;
};

type Transform2D = SchemaToType<typeof TransformDefinition2D>;
type Collider2D = SchemaToType<typeof collider2D>;
type CollisionBody2D = SchemaToType<typeof collisionBody2D>;
type ColliderEntity2D = Transform2D & Collider2D & CollisionBody2D;

export type CollisionPlugin2DOptions = {
  gravityY?: number;
  maxDeltaSeconds?: number;
};

export type Collision2DPluginState = {
  engine: Matter.Engine;
  world: Matter.World;
};

export type CollisionPlugin2DPluginRequiredContext = {};
export type CollisionPlugin2DPluginOptions = CollisionPlugin2DOptions;

const isTransform2D = createObjectGuard(TransformDefinition2D);
const isCollider2D = createObjectGuard(collider2D);
const isCollisionBody2D = createObjectGuard(collisionBody2D);

const isColliderEntity2D = (sceneObject: SceneObject): sceneObject is ColliderEntity2D =>
  isTransform2D(sceneObject) && isCollider2D(sceneObject) && isCollisionBody2D(sceneObject);

const collisionCallbacks = createCallbackRegistry<(event: Collision2DEvent) => void>();

export function onCollision(callback: (event: Collision2DEvent) => void): () => void {
  return collisionCallbacks.register(callback);
}

function toMatterPosition(worldYUp: number): number {
  return -worldYUp;
}

function fromMatterPosition(matterYDown: number): number {
  return -matterYDown;
}

function toMatterAngle(worldRotationRadians: number): number {
  return -worldRotationRadians;
}

function fromMatterAngle(matterAngleRadians: number): number {
  return -matterAngleRadians;
}

function colliderSettingsKey(colliderEntity: ColliderEntity2D): string {
  const collider2D = colliderEntity.collider2D;
  const collisionBody2D = colliderEntity.collisionBody2D;
  return JSON.stringify({
    shape: collider2D.shape,
    radius: collider2D.radius,
    width: collider2D.width,
    height: collider2D.height,
    isSensor: collider2D.isSensor,
    category: collider2D.category,
    mask: collider2D.mask,
    group: collider2D.group,
    isStatic: collisionBody2D.isStatic,
    mass: collisionBody2D.mass,
    friction: collisionBody2D.friction,
    frictionAir: collisionBody2D.frictionAir,
    restitution: collisionBody2D.restitution,
  });
}

function createMatterBodyFromColliderEntity(colliderEntity: ColliderEntity2D): Matter.Body {
  const { x, y, rotation } = colliderEntity.transform2D;
  const matterX = x;
  const matterY = toMatterPosition(y);
  const matterAngle = toMatterAngle(rotation);

  const collider2D = colliderEntity.collider2D;
  const collisionBody2D = colliderEntity.collisionBody2D;

  const options: Matter.IChamferableBodyDefinition = {
    isStatic: collisionBody2D.isStatic,
    mass: collisionBody2D.mass,
    friction: collisionBody2D.friction,
    frictionAir: collisionBody2D.frictionAir,
    restitution: collisionBody2D.restitution,
    isSensor: collider2D.isSensor,
    collisionFilter: {
      category: collider2D.category,
      mask: collider2D.mask,
      group: collider2D.group,
    },
    render: { visible: false },
  };

  const matterBody =
    collider2D.shape === "circle"
      ? Matter.Bodies.circle(matterX, matterY, collider2D.radius, options)
      : Matter.Bodies.rectangle(matterX, matterY, collider2D.width, collider2D.height, options);

  Matter.Body.setAngle(matterBody, matterAngle);
  return matterBody;
}

export type CollisionPlugin2DContext = {
  collision2D: Collision2DPluginState;
};

export type CollisionPlugin2DOutputContext = CollisionPlugin2DContext;

export const collisionPlugin2D = definePlugin<
  CollisionPlugin2DOptions,
  CollisionPlugin2DPluginRequiredContext,
  CollisionPlugin2DOutputContext & CollisionPlugin2DPluginRequiredContext
>(
  (options?: CollisionPlugin2DOptions) => (inputContext: CollisionPlugin2DPluginRequiredContext) => {
    const gravityY = options?.gravityY ?? 0;
    const maxDeltaSeconds = options?.maxDeltaSeconds ?? 1 / 30;

    const engine = Matter.Engine.create();
    engine.gravity.x = 0;
    engine.gravity.y = gravityY;
    engine.enableSleeping = false;

    const world = engine.world;

    const matterBodyByColliderEntity = new Map<ColliderEntity2D, Matter.Body>();
    const colliderEntityByMatterBody = new Map<Matter.Body, ColliderEntity2D>();
    const lastSettingsKeyByColliderEntity = new Map<ColliderEntity2D, string>();

    const pendingCollisions: Collision2DEvent[] = [];

    Matter.Events.on(engine, "collisionStart", (event: Matter.IEventCollision<Matter.Engine>) => {
      const pairs = event.pairs ?? [];
      for (const pair of pairs) {
        const bodyA = pair.bodyA as Matter.Body;
        const bodyB = pair.bodyB as Matter.Body;
        const sceneObjectA = colliderEntityByMatterBody.get(bodyA);
        const sceneObjectB = colliderEntityByMatterBody.get(bodyB);
        if (!sceneObjectA || !sceneObjectB) continue;

        pendingCollisions.push({
          a: sceneObjectA,
          b: sceneObjectB,
          bodyA,
          bodyB,
          pair,
        });
      }
    });

    gameUpdate((deltaTime) => {
      const scene = getScene();
      const colliderEntities = scene.query({
        callback: isColliderEntity2D,
        cacheKey: "collision2d-entities",
      });
      const colliderEntitySet = new Set(colliderEntities);

      for (const colliderEntity of colliderEntities) {
        const settingsKey = colliderSettingsKey(colliderEntity);
        const existingMatterBody = matterBodyByColliderEntity.get(colliderEntity);

        if (!existingMatterBody) {
          const matterBody = createMatterBodyFromColliderEntity(colliderEntity);
          matterBodyByColliderEntity.set(colliderEntity, matterBody);
          colliderEntityByMatterBody.set(matterBody, colliderEntity);
          lastSettingsKeyByColliderEntity.set(colliderEntity, settingsKey);
          Matter.World.add(world, matterBody);
          continue;
        }

        if (lastSettingsKeyByColliderEntity.get(colliderEntity) !== settingsKey) {
          Matter.World.remove(world, existingMatterBody);
          colliderEntityByMatterBody.delete(existingMatterBody);

          const matterBody = createMatterBodyFromColliderEntity(colliderEntity);
          matterBodyByColliderEntity.set(colliderEntity, matterBody);
          colliderEntityByMatterBody.set(matterBody, colliderEntity);
          lastSettingsKeyByColliderEntity.set(colliderEntity, settingsKey);
          Matter.World.add(world, matterBody);
        }

        const isStatic = colliderEntity.collisionBody2D.isStatic;
        if (isStatic) {
          const matterBody = matterBodyByColliderEntity.get(colliderEntity);
          if (!matterBody) continue;
          Matter.Body.setPosition(matterBody, {
            x: colliderEntity.transform2D.x,
            y: toMatterPosition(colliderEntity.transform2D.y),
          });
          Matter.Body.setAngle(matterBody, toMatterAngle(colliderEntity.transform2D.rotation));
          Matter.Body.setVelocity(matterBody, { x: 0, y: 0 });
          Matter.Body.setAngularVelocity(matterBody, 0);
        }
      }

      for (const [colliderEntity, matterBody] of matterBodyByColliderEntity.entries()) {
        if (colliderEntitySet.has(colliderEntity)) continue;
        Matter.World.remove(world, matterBody);
        colliderEntityByMatterBody.delete(matterBody);
        matterBodyByColliderEntity.delete(colliderEntity);
        lastSettingsKeyByColliderEntity.delete(colliderEntity);
      }

      for (const colliderEntity of colliderEntities) {
        if (colliderEntity.collisionBody2D.isStatic) continue;
        const matterBody = matterBodyByColliderEntity.get(colliderEntity);
        if (!matterBody) continue;
        Matter.Body.setPosition(matterBody, {
          x: colliderEntity.transform2D.x,
          y: toMatterPosition(colliderEntity.transform2D.y),
        });
        Matter.Body.setAngle(matterBody, toMatterAngle(colliderEntity.transform2D.rotation));
      }

      pendingCollisions.length = 0;

      const dt = Math.min(deltaTime, maxDeltaSeconds);
      Matter.Engine.update(engine, dt * 1000);

      for (const [colliderEntity, matterBody] of matterBodyByColliderEntity.entries()) {
        if (colliderEntity.collisionBody2D.isStatic) continue;
        colliderEntity.transform2D.x = matterBody.position.x;
        colliderEntity.transform2D.y = fromMatterPosition(matterBody.position.y);
        colliderEntity.transform2D.rotation = fromMatterAngle(matterBody.angle);
      }

      if (pendingCollisions.length > 0) {
        for (const event of pendingCollisions) collisionCallbacks.run(event);
      }
    });

    return {
      ...inputContext,
      collision2D: {
        engine,
        world,
      },
    };
  },
);

