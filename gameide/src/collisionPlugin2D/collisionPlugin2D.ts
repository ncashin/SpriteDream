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
  // Default: no gravity (collisions only).
  gravityY?: number;
  // Prevent large dt spikes from destabilizing the solver.
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

const isColliderEntity2D = (obj: SceneObject): obj is ColliderEntity2D =>
  isTransform2D(obj) && isCollider2D(obj) && isCollisionBody2D(obj);

const collisionCallbacks = createCallbackRegistry<(event: Collision2DEvent) => void>();

export function onCollision(callback: (event: Collision2DEvent) => void): () => void {
  return collisionCallbacks.register(callback);
}

function toMatterPosition(worldYUp: number): number {
  // Our scene uses y-up coordinates; Matter uses y-down screen coordinates.
  return -worldYUp;
}

function fromMatterPosition(matterYDown: number): number {
  return -matterYDown;
}

function toMatterAngle(worldRotationRadians: number): number {
  // Reflecting across the X-axis flips rotation direction.
  return -worldRotationRadians;
}

function fromMatterAngle(matterAngleRadians: number): number {
  return -matterAngleRadians;
}

function colliderSettingsKey(obj: ColliderEntity2D): string {
  // Used to detect when we need to rebuild a Matter body.
  const c = obj.collider2D;
  const b = obj.collisionBody2D;
  return JSON.stringify({
    shape: c.shape,
    radius: c.radius,
    width: c.width,
    height: c.height,
    isSensor: c.isSensor,
    category: c.category,
    mask: c.mask,
    group: c.group,
    isStatic: b.isStatic,
    mass: b.mass,
    friction: b.friction,
    frictionAir: b.frictionAir,
    restitution: b.restitution,
  });
}

function createMatterBodyFromObject(obj: ColliderEntity2D): Matter.Body {
  const { x, y, rotation } = obj.transform2D;
  const matterX = x;
  const matterY = toMatterPosition(y);
  const matterAngle = toMatterAngle(rotation);

  const c = obj.collider2D;
  const b = obj.collisionBody2D;

  const options: Matter.IBodyDefinition = {
    isStatic: b.isStatic,
    mass: b.mass,
    friction: b.friction,
    frictionAir: b.frictionAir,
    restitution: b.restitution,
    isSensor: c.isSensor,
    collisionFilter: {
      category: c.category,
      mask: c.mask,
      group: c.group,
    },
    render: { visible: false },
  };

  const body =
    c.shape === "circle"
      ? Matter.Bodies.circle(matterX, matterY, c.radius, options)
      : Matter.Bodies.rectangle(matterX, matterY, c.width, c.height, options);

  Matter.Body.setAngle(body, matterAngle);
  return body;
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
    // Keep the simulation active even when bodies sleep.
    engine.enableSleeping = false;

    const world = engine.world;

    // Map scene objects to Matter bodies.
    const bodyByObject = new Map<ColliderEntity2D, Matter.Body>();
    const objectByBody = new Map<Matter.Body, ColliderEntity2D>();
    const lastSettingsKeyByObject = new Map<ColliderEntity2D, string>();

    // Collision events are pushed here during Engine.update, then drained after we sync transforms.
    const pendingCollisions: Collision2DEvent[] = [];

    Matter.Events.on(engine, "collisionStart", (event: Matter.IEventCollision<Matter.Engine>) => {
      const pairs = event.pairs ?? [];
      for (const pair of pairs) {
        const bodyA = pair.bodyA as Matter.Body;
        const bodyB = pair.bodyB as Matter.Body;
        const a = objectByBody.get(bodyA);
        const b = objectByBody.get(bodyB);
        if (!a || !b) continue;

        pendingCollisions.push({
          a,
          b,
          bodyA,
          bodyB,
          pair,
        });
      }
    });

    gameUpdate((deltaTime) => {
      const scene = getScene();
      const activeObjects = scene.query(isColliderEntity2D);
      const activeSet = new Set(activeObjects);

      // Create or rebuild bodies for active objects.
      for (const obj of activeObjects) {
        const settingsKey = colliderSettingsKey(obj);
        const existing = bodyByObject.get(obj);

        if (!existing) {
          const body = createMatterBodyFromObject(obj);
          bodyByObject.set(obj, body);
          objectByBody.set(body, obj);
          lastSettingsKeyByObject.set(obj, settingsKey);
          Matter.World.add(world, body);
          continue;
        }

        if (lastSettingsKeyByObject.get(obj) !== settingsKey) {
          // Rebuild the body when collider/body settings change.
          const oldBody = existing;
          Matter.World.remove(world, oldBody);
          objectByBody.delete(oldBody);

          const body = createMatterBodyFromObject(obj);
          bodyByObject.set(obj, body);
          objectByBody.set(body, obj);
          lastSettingsKeyByObject.set(obj, settingsKey);
          Matter.World.add(world, body);
        }

        // Sync pose from transform for static bodies so editor-driven movement stays consistent.
        const isStatic = obj.collisionBody2D.isStatic;
        if (isStatic) {
          const body = bodyByObject.get(obj);
          if (!body) continue;
          Matter.Body.setPosition(body, {
            x: obj.transform2D.x,
            y: toMatterPosition(obj.transform2D.y),
          });
          Matter.Body.setAngle(body, toMatterAngle(obj.transform2D.rotation));
          Matter.Body.setVelocity(body, { x: 0, y: 0 });
          Matter.Body.setAngularVelocity(body, 0);
        }
      }

      // Remove bodies for deleted objects.
      for (const [obj, body] of bodyByObject.entries()) {
        if (activeSet.has(obj)) continue;
        Matter.World.remove(world, body);
        objectByBody.delete(body);
        bodyByObject.delete(obj);
        lastSettingsKeyByObject.delete(obj);
      }

      pendingCollisions.length = 0;

      // Advance physics.
      const dt = Math.min(deltaTime, maxDeltaSeconds);
      Matter.Engine.update(engine, dt * 1000);

      // Sync transform from physics for dynamic bodies.
      for (const [obj, body] of bodyByObject.entries()) {
        if (obj.collisionBody2D.isStatic) continue;
        obj.transform2D.x = body.position.x;
        obj.transform2D.y = fromMatterPosition(body.position.y);
        obj.transform2D.rotation = fromMatterAngle(body.angle);
      }

      // Drain collision events after pose sync, so callbacks can read transform2D values.
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

