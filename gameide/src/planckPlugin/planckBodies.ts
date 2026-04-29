/**
 * Scene objects with `boxCollider` / `circleCollider` traits are mirrored into Planck {@link Body}
 * instances. This module builds those bodies and fingerprints collider data so we can recreate a
 * body when width, radius, offsets, material on {@link collisionBodyTrait}, or body type changes.
 */
import { type Body, type BodyType, type World, Vec2, Box, Circle } from "planck";
import type { BaseSceneObject } from "../scene/scene.js";

export type PhysicsUserData = { object: BaseSceneObject };

export type PlanckRecord = {
  body: Body;
  /** Hash of collider + body-type fields; mismatch means destroy and recreate the body. */
  signature: string;
};

export function isColliderNode(v: unknown): v is BaseSceneObject {
  if (!v || typeof v !== "object") return false;
  return "boxCollider" in v || "circleCollider" in v;
}

export function sceneVec(x: number, y: number): Vec2 {
  return new Vec2(x, y);
}

function collisionFixedRotation(obj: BaseSceneObject): boolean {
  return Boolean(
    (obj as { collisionBody?: { fixedRotation?: boolean } }).collisionBody?.fixedRotation,
  );
}

/** When true, no Planck {@link Body} is created until disabled is cleared — no collisions or contact callbacks. */
export function collisionBodyDisabled(obj: BaseSceneObject): boolean {
  const cb = (obj as { collisionBody?: { disabled?: unknown } }).collisionBody;
  return cb?.disabled === true;
}

function collisionMaterial(obj: BaseSceneObject): {
  isTrigger: boolean;
  restitution: number;
  friction: number;
} {
  const cb = (obj as {
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
  obj: BaseSceneObject,
  effectiveBodyType: BodyType,
): boolean {
  if (effectiveBodyType === "static") return true;
  return collisionFixedRotation(obj);
}

export function colliderSignature(
  obj: BaseSceneObject,
  effectiveBodyType: BodyType,
): string {
  const bodyT = effectiveBodyType;
  const fixedRotation = effectiveFixedRotation(obj, effectiveBodyType);
  const { isTrigger: t, restitution: rest, friction: fr } = collisionMaterial(obj);
  const dis = collisionBodyDisabled(obj) ? 1 : 0;
  const b = (obj as { boxCollider?: Record<string, unknown> }).boxCollider;
  if (b && typeof b === "object") {
    return JSON.stringify({
      k: "box",
      bodyT,
      fixedRotation,
      w: b.width,
      h: b.height,
      t,
      rest,
      fr,
      dis,
      ox: (b.offset as { x?: number })?.x,
      oy: (b.offset as { y?: number })?.y,
    });
  }
  const c = (obj as { circleCollider?: Record<string, unknown> }).circleCollider;
  if (c && typeof c === "object") {
    return JSON.stringify({
      k: "circle",
      bodyT,
      fixedRotation,
      r: c.radius,
      t,
      rest,
      fr,
      dis,
      ox: (c.offset as { x?: number })?.x,
      oy: (c.offset as { y?: number })?.y,
    });
  }
  return "";
}

export function createBodyForObject(
  world: World,
  obj: BaseSceneObject,
  effectiveBodyType: BodyType,
): PlanckRecord | null {
  if (collisionBodyDisabled(obj)) {
    return null;
  }
  const signature = colliderSignature(obj, effectiveBodyType);
  if (!signature) return null;
  if (
    !(
      (obj as { position?: { x: number; y: number } }).position &&
      (obj as { rotation?: { z: number } }).rotation
    )
  ) {
    return null;
  }

  const pos = (obj as { position: { x: number; y: number } }).position;
  const rotZ = (obj as { rotation: { z: number } }).rotation.z;
  const bodyT = effectiveBodyType;
  const fixedRotation = effectiveFixedRotation(obj, effectiveBodyType);

  const body = world.createBody({
    type: bodyT,
    position: sceneVec(pos.x, pos.y),
    angle: rotZ,
    userData: { object: obj } satisfies PhysicsUserData,
    fixedRotation,
  });

  const { isTrigger, restitution, friction } = collisionMaterial(obj);

  const b = (obj as { boxCollider?: Record<string, unknown> }).boxCollider;
  if (b && typeof b === "object") {
    const w = Math.max(1e-6, Number(b.width) || 0) / 2;
    const h = Math.max(1e-6, Number(b.height) || 0) / 2;
    const off = (b.offset as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
    const opt = {
      density: bodyT === "dynamic" ? 1 : 0,
      friction,
      restitution,
      isSensor: isTrigger,
    };
    body.createFixture(new Box(w, h, new Vec2(off.x, off.y)), opt);
  } else {
    const c = (obj as { circleCollider?: Record<string, unknown> }).circleCollider;
    if (c && typeof c === "object") {
      const r = Math.max(1e-6, Number(c.radius) || 0);
      const off = (c.offset as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
      const opt = {
        density: bodyT === "dynamic" ? 1 : 0,
        friction,
        restitution,
        isSensor: isTrigger,
      };
      body.createFixture(new Circle(new Vec2(off.x, off.y), r), opt);
    } else {
      world.destroyBody(body);
      return null;
    }
  }

  if (bodyT === "dynamic") {
    const vel =
      (obj as { collisionBody?: { velocity?: { x: number; y: number; angular?: number } } })
        .collisionBody?.velocity ?? { x: 0, y: 0, angular: 0 };
    body.setLinearVelocity(sceneVec(vel.x, vel.y));
    body.setAngularVelocity(vel.angular ?? 0);
  }

  return { body, signature };
}

export function getBodyData(body: Body): BaseSceneObject | null {
  const d = body.getUserData() as PhysicsUserData | null | undefined;
  return d?.object ?? null;
}
