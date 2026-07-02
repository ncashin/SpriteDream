import { type Body, type BodyType, type World, Vec2, Box, Circle } from "planck";
import { implementsTrait, type GameObject } from "gameide";
import { boxColliderTrait, circleColliderTrait } from "./colliderComponents.js";
import { collisionBodyTrait } from "./collisionBody.js";
import { getSceneBodyType } from "./planckBodyTypes.js";
import { readTransformPose } from "../transform.js";

export type PhysicsUserData = {
  object: GameObject;
  sceneKey: PropertyKey;
};

export type PlanckRecord = {
  body: Body;
  signature: string;
};

type ColliderKind = "box" | "circle";

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readTransform(object: GameObject): {
  x: number;
  y: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
} {
  const world = readTransformPose(object, "world");
  return {
    x: finiteNumberOr(world.position.x, 0),
    y: finiteNumberOr(world.position.y, 0),
    rotationZ: finiteNumberOr(world.rotation.z, 0),
    scaleX: finiteNumberOr(world.scale.x, 1),
    scaleY: finiteNumberOr(world.scale.y, 1),
  };
}

function readPhysicsShapeTransform(
  object: GameObject,
  effectiveBodyType: BodyType,
  colliderKind: ColliderKind,
): ReturnType<typeof readTransform> {
  const world = readTransform(object);
  const sceneBodyType = getSceneBodyType(object);
  if (colliderKind === "circle") return world;
  if (sceneBodyType !== "dynamic" && effectiveBodyType !== "dynamic") {
    return world;
  }

  const local = readTransformPose(object, "local");
  return {
    ...world,
    scaleX: finiteNumberOr(local.scale.x, 1),
    scaleY: finiteNumberOr(local.scale.y, 1),
  };
}

export function syncBodyTransformFromObject(
  body: Body,
  object: GameObject,
  pixelsPerMeter: number,
): void {
  const transform = readTransform(object);
  const inv = 1 / pixelsPerMeter;
  body.setTransform(
    sceneVec(transform.x * inv, transform.y * inv),
    transform.rotationZ,
  );
}

export function isColliderNode(v: unknown): v is GameObject {
  if (!v || typeof v !== "object") return false;
  return "boxCollider" in v || "circleCollider" in v;
}

const qualifiesBoxPhysicsBody = (v: unknown) =>
  implementsTrait(v, [collisionBodyTrait, boxColliderTrait]);
const qualifiesCirclePhysicsBody = (v: unknown) =>
  implementsTrait(v, [collisionBodyTrait, circleColliderTrait]);

/** Scene object has a registered collider shape and collision body for Planck. */
export function qualifiesForPlanckBody(v: unknown): v is GameObject {
  return qualifiesBoxPhysicsBody(v) || qualifiesCirclePhysicsBody(v);
}

export function sceneVec(x: number, y: number): Vec2 {
  return new Vec2(x, y);
}

function collisionFixedRotation(object: GameObject): boolean {
  return Boolean(
    (object as { collisionBody?: { fixedRotation?: boolean } }).collisionBody?.fixedRotation,
  );
}

function collisionContinuous(object: GameObject): boolean {
  return Boolean(
    (object as { collisionBody?: { continuous?: boolean } }).collisionBody?.continuous,
  );
}

/** When true, no Planck {@link Body} is created until disabled is cleared — no collisions or contact callbacks. */
export function collisionBodyDisabled(object: GameObject): boolean {
  const cb = (object as { collisionBody?: { disabled?: unknown } }).collisionBody;
  return cb?.disabled === true;
}

function collisionMaterial(object: GameObject): {
  isTrigger: boolean;
  restitution: number;
  friction: number;
} {
  const cb = (object as {
    collisionBody?: { isTrigger?: boolean; restitution?: unknown; friction?: unknown };
  }).collisionBody;
  const restitution = Number(cb?.restitution);
  const friction = Number(cb?.friction);
  return {
    isTrigger: Boolean(cb?.isTrigger),
    restitution: Math.max(
      0,
      Math.min(1, Number.isFinite(restitution) ? restitution : 0),
    ),
    friction: Number.isFinite(friction) ? Math.max(0, friction) : 0.3,
  };
}

/** Static bodies always use fixed rotation in Planck (pose comes from the scene each frame). */
function effectiveFixedRotation(
  object: GameObject,
  effectiveBodyType: BodyType,
): boolean {
  if (effectiveBodyType === "static") return true;
  return collisionFixedRotation(object);
}

export function colliderSignature(
  object: GameObject,
  effectiveBodyType: BodyType,
): string {
  const bodyT = effectiveBodyType;
  const fixedRotation = effectiveFixedRotation(object, effectiveBodyType);
  const continuous = collisionContinuous(object);
  const { isTrigger: t, restitution: rest, friction: fr } = collisionMaterial(object);
  const dis = collisionBodyDisabled(object) ? 1 : 0;
  const b = (object as { boxCollider?: Record<string, unknown> }).boxCollider;
  if (b && typeof b === "object") {
    const transform = readPhysicsShapeTransform(object, effectiveBodyType, "box");
    return JSON.stringify({
      k: "box",
      bodyT,
      fixedRotation,
      continuous,
      w: b.width,
      h: b.height,
      t,
      rest,
      fr,
      dis,
      ox: (b.offset as { x?: number })?.x,
      oy: (b.offset as { y?: number })?.y,
      sx: transform.scaleX,
      sy: transform.scaleY,
    });
  }
  const c = (object as { circleCollider?: Record<string, unknown> }).circleCollider;
  if (c && typeof c === "object") {
    const transform = readPhysicsShapeTransform(object, effectiveBodyType, "circle");
    return JSON.stringify({
      k: "circle",
      bodyT,
      fixedRotation,
      continuous,
      r: c.radius,
      t,
      rest,
      fr,
      dis,
      ox: (c.offset as { x?: number })?.x,
      oy: (c.offset as { y?: number })?.y,
      sx: transform.scaleX,
      sy: transform.scaleY,
    });
  }
  return "";
}

export function createBodyForObject(
  world: World,
  object: GameObject,
  effectiveBodyType: BodyType,
  pixelsPerMeter: number,
  sceneKey: PropertyKey,
): PlanckRecord | null {
  const inv = 1 / pixelsPerMeter;
  if (collisionBodyDisabled(object)) {
    return null;
  }
  const signature = colliderSignature(object, effectiveBodyType);
  if (!signature) return null;

  const bodyT = effectiveBodyType;
  const fixedRotation = effectiveFixedRotation(object, effectiveBodyType);
  const b = (object as { boxCollider?: Record<string, unknown> }).boxCollider;
  const c = (object as { circleCollider?: Record<string, unknown> }).circleCollider;
  const transform = readPhysicsShapeTransform(
    object,
    effectiveBodyType,
    b && typeof b === "object" ? "box" : "circle",
  );
  const scaleX = transform.scaleX;
  const scaleY = transform.scaleY;

  const body = world.createBody({
    type: bodyT,
    position: sceneVec(transform.x * inv, transform.y * inv),
    angle: transform.rotationZ,
    userData: { object, sceneKey } satisfies PhysicsUserData,
    fixedRotation,
    bullet: collisionContinuous(object),
  });

  const { isTrigger, restitution, friction } = collisionMaterial(object);

  if (b && typeof b === "object") {
    const w = (Math.max(1e-6, Number(b.width) || 0) * Math.abs(scaleX) / 2) * inv;
    const h = (Math.max(1e-6, Number(b.height) || 0) * Math.abs(scaleY) / 2) * inv;
    const off = (b.offset as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
    const opt = {
      density: bodyT === "dynamic" ? 1 : 0,
      friction,
      restitution,
      isSensor: isTrigger,
    };
    body.createFixture(
      new Box(w, h, new Vec2(off.x * scaleX * inv, off.y * scaleY * inv)),
      opt,
    );
  } else {
    if (c && typeof c === "object") {
      const radiusScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));
      const r = Math.max(1e-6, Number(c.radius) || 0) * radiusScale * inv;
      const off = (c.offset as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
      const opt = {
        density: bodyT === "dynamic" ? 1 : 0,
        friction,
        restitution,
        isSensor: isTrigger,
      };
      body.createFixture(
        new Circle(new Vec2(off.x * scaleX * inv, off.y * scaleY * inv), r),
        opt,
      );
    } else {
      world.destroyBody(body);
      return null;
    }
  }

  if (bodyT === "dynamic") {
    const vel =
      (
        object as {
          collisionBody?: { velocity?: { x: number; y: number; angular?: number } };
        }
      ).collisionBody?.velocity ?? { x: 0, y: 0, angular: 0 };
    body.setLinearVelocity(sceneVec(vel.x * inv, vel.y * inv));
    body.setAngularVelocity(vel.angular ?? 0);
  }

  return { body, signature };
}

export function getBodyData(body: Body): GameObject | null {
  const d = body.getUserData() as PhysicsUserData | null | undefined;
  return d?.object ?? null;
}

export function getBodySceneKey(body: Body): PropertyKey | undefined {
  const d = body.getUserData() as PhysicsUserData | null | undefined;
  return d?.sceneKey;
}
