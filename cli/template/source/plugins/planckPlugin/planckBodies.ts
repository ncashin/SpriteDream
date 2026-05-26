import { type Body, type BodyType, type World, Vec2, Box, Circle } from "planck";
import type { GameObject } from "gameide";

export type PhysicsUserData = {
  object: GameObject;
  sceneKey: PropertyKey;
};

export type PlanckRecord = {
  body: Body;
  signature: string;
};

export function isColliderNode(v: unknown): v is GameObject {
  if (!v || typeof v !== "object") return false;
  return "boxCollider" in v || "circleCollider" in v;
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
    });
  }
  const c = (object as { circleCollider?: Record<string, unknown> }).circleCollider;
  if (c && typeof c === "object") {
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
  if (
    !(
      (object as { position?: { x: number; y: number } }).position &&
      (object as { rotation?: { z: number } }).rotation
    )
  ) {
    return null;
  }

  const pos = (object as { position: { x: number; y: number } }).position;
  const rotZ = (object as { rotation: { z: number } }).rotation.z;
  const bodyT = effectiveBodyType;
  const fixedRotation = effectiveFixedRotation(object, effectiveBodyType);

  const body = world.createBody({
    type: bodyT,
    position: sceneVec(pos.x * inv, pos.y * inv),
    angle: rotZ,
    userData: { object, sceneKey } satisfies PhysicsUserData,
    fixedRotation,
    bullet: collisionContinuous(object),
  });

  const { isTrigger, restitution, friction } = collisionMaterial(object);

  const b = (object as { boxCollider?: Record<string, unknown> }).boxCollider;
  if (b && typeof b === "object") {
    const w = (Math.max(1e-6, Number(b.width) || 0) / 2) * inv;
    const h = (Math.max(1e-6, Number(b.height) || 0) / 2) * inv;
    const off = (b.offset as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
    const opt = {
      density: bodyT === "dynamic" ? 1 : 0,
      friction,
      restitution,
      isSensor: isTrigger,
    };
    body.createFixture(new Box(w, h, new Vec2(off.x * inv, off.y * inv)), opt);
  } else {
    const c = (object as { circleCollider?: Record<string, unknown> }).circleCollider;
    if (c && typeof c === "object") {
      const r = Math.max(1e-6, Number(c.radius) || 0) * inv;
      const off = (c.offset as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
      const opt = {
        density: bodyT === "dynamic" ? 1 : 0,
        friction,
        restitution,
        isSensor: isTrigger,
      };
      body.createFixture(new Circle(new Vec2(off.x * inv, off.y * inv), r), opt);
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
