/**
 * Scene objects with `boxCollider` / `circleCollider` traits are mirrored into Planck {@link Body}
 * instances. This module builds those bodies and fingerprints collider data so we can recreate a
 * body when width, radius, offsets, trigger flag, or authored {@link collisionBodyTrait} type changes.
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
  const b = (obj as { boxCollider?: Record<string, unknown> }).boxCollider;
  if (b && typeof b === "object") {
    return JSON.stringify({
      k: "box",
      bodyT,
      fixedRotation,
      w: b.width,
      h: b.height,
      t: b.isTrigger,
      rest: b.restitution,
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
      t: c.isTrigger,
      rest: c.restitution,
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

  const b = (obj as { boxCollider?: Record<string, unknown> }).boxCollider;
  if (b && typeof b === "object") {
    const w = Math.max(1e-6, Number(b.width) || 0) / 2;
    const h = Math.max(1e-6, Number(b.height) || 0) / 2;
    const isTrigger = Boolean(b.isTrigger);
    const off = (b.offset as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
    const restitution = Math.max(0, Math.min(1, Number(b.restitution) || 0));
    const opt = {
      density: bodyT === "dynamic" ? 1 : 0,
      friction: 0.3,
      restitution,
      isSensor: isTrigger,
    };
    body.createFixture(new Box(w, h, new Vec2(off.x, off.y)), opt);
  } else {
    const c = (obj as { circleCollider?: Record<string, unknown> }).circleCollider;
    if (c && typeof c === "object") {
      const r = Math.max(1e-6, Number(c.radius) || 0);
      const isTrigger = Boolean(c.isTrigger);
      const off = (c.offset as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
      const restitution = Math.max(0, Math.min(1, Number(c.restitution) || 0));
      const opt = {
        density: bodyT === "dynamic" ? 1 : 0,
        friction: 0.3,
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
