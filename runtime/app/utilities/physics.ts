import Atom from "lucide/dist/esm/icons/atom.mjs";
import Square from "lucide/dist/esm/icons/square.mjs";
import { BoxShape, Vec2, World, type Body } from "planck";
import { defaulted, enum_, object } from "remix/data-schema";
import { boolean, number } from "remix/data-schema/coerce";

import type { GameObject } from "../actions/editor/object-tree.tsx";
import { addBoundingBoxLookup, lookupBoundingBox } from "./bounding-box.ts";
import { isObject } from "./is-object.ts";
import { queryScene, scene } from "./scene.ts";
import { defineTrait } from "./trait/trait.ts";
import "./viewport/draw-image.ts";
import { parentObject, transform } from "./viewport/transform.ts";

const bodyTypes = ["static", "kinematic", "dynamic"] as const;

export const colliderTrait = defineTrait(
  "Collider",
  Square,
  object({
    friction: defaulted(number(), 0.3),
    restitution: defaulted(number(), 0),
    sensor: defaulted(boolean(), false),
  }),
);

export const physicsBodyTrait = defineTrait(
  "Physics Body",
  Atom,
  object({
    body: defaulted(enum_(bodyTypes), "dynamic"),
    density: defaulted(number(), 1),
    fixedRotation: defaulted(boolean(), false),
    gravity: defaulted(number(), 9.8),
    velocity: defaulted(
      object({
        x: defaulted(number(), 0),
        y: defaulted(number(), 0),
      }),
      { x: 0, y: 0 },
    ),
  }),
);

export type Collider = NonNullable<ReturnType<typeof colliderTrait>>;
export type PhysicsBody = NonNullable<ReturnType<typeof physicsBodyTrait>>;

addBoundingBoxLookup((object) => {
  if (!colliderTrait(object)) return;
  return { width: 64, height: 64 };
});

const pixelsPerMeter = 128;
const maxStep = 1 / 20;

function toMeters(pixels: number) {
  return pixels / pixelsPerMeter;
}

function toPixels(meters: number) {
  return meters * pixelsPerMeter;
}

const world = new World(Vec2(0, 0));
const simulated = new Map<GameObject, Body>();

export function stepPhysics(deltaTime: number) {
  if (!(deltaTime > 0)) return;

  const bodies = queryScene(scene, physicsBodyTrait).filter((object) => !hostedCollider(object));
  const colliders = queryScene(scene, colliderTrait).filter((object) => !hostedCollider(object));
  const live = new Set<GameObject>([...bodies, ...colliders]);
  for (const [object, body] of simulated) {
    if (live.has(object)) continue;
    world.destroyBody(body);
    simulated.delete(object);
  }
  for (const object of live) {
    if (!simulated.has(object)) createBody(object);
    else syncFromScene(object, deltaTime);
  }

  for (const object of bodies) applyGravity(object);

  world.step(Math.min(deltaTime, maxStep), 8, 3);

  for (const object of bodies) writeBack(object);
}

export function resetPhysics() {
  for (const body of simulated.values()) world.destroyBody(body);
  simulated.clear();
}

function createBody(object: GameObject) {
  const placement = transform(object);
  if (!placement) return;

  const physics = physicsBodyTrait(object);
  const collider = colliderTrait(object);
  const body = world.createBody({
    type: physics?.physicsBody.body ?? "static",
    position: Vec2(toMeters(placement.position.x), toMeters(placement.position.y)),
    angle: (placement.rotation * Math.PI) / 180,
    fixedRotation: physics?.physicsBody.fixedRotation ?? false,
  });
  if (collider) addColliderFixture(body, object, object);
  for (const child of propagatedColliders(object)) addColliderFixture(body, child, object);
  const velocity = physics?.physicsBody.velocity;
  if (velocity) body.setLinearVelocity(Vec2(toMeters(velocity.x), toMeters(velocity.y)));
  simulated.set(object, body);
}

function syncFromScene(object: GameObject, deltaTime: number) {
  const body = simulated.get(object);
  const placement = transform(object);
  if (!body || !placement) return;

  const position = Vec2(toMeters(placement.position.x), toMeters(placement.position.y));
  const angle = (placement.rotation * Math.PI) / 180;
  const physics = physicsBodyTrait(object)?.physicsBody;
  if (physics?.body === "kinematic") {
    const previous = body.getPosition();
    const previousAngle = body.getAngle();
    body.setLinearVelocity(
      Vec2((position.x - previous.x) / deltaTime, (position.y - previous.y) / deltaTime),
    );
    body.setAngularVelocity((angle - previousAngle) / deltaTime);
  }
  body.setTransform(position, angle);
  if (physics?.body === "dynamic") {
    body.setLinearVelocity(Vec2(toMeters(physics.velocity.x), toMeters(physics.velocity.y)));
  }
}

function propagatesCollision(object: GameObject) {
  const value = object.propagateCollision;
  return value === true || value === "true";
}

function hostedCollider(object: GameObject) {
  return Boolean(colliderTrait(object) && collisionHost(object));
}

function collisionHost(object: GameObject): GameObject | undefined {
  const parent = parentObject(object);
  if (!parent) return;
  const higher = collisionHost(parent);
  if (higher) return higher;
  if (propagatesCollision(parent) && colliderTrait(parent)) return parent;
}

function propagatedColliders(host: GameObject) {
  return queryScene(scene, (node) => {
    if (!isObject(node) || node instanceof DOMMatrix || collisionHost(node) !== host) return;
    return colliderTrait(node);
  });
}

function addColliderFixture(body: Body, object: Collider, host: GameObject) {
  const placement = transform(object);
  const hostPlacement = transform(host);
  if (!placement || !hostPlacement) return;

  const bounds = lookupBoundingBox(object);
  const width = toMeters(Math.abs((bounds?.width ?? 64) * placement.scale.x));
  const height = toMeters(Math.abs((bounds?.height ?? 64) * placement.scale.y));
  const local = bodyLocal(hostPlacement, placement);
  const physics = physicsBodyTrait(host);
  body.createFixture(
    BoxShape(
      Math.max(width, toMeters(1)) / 2,
      Math.max(height, toMeters(1)) / 2,
      Vec2(local.x, local.y),
      local.angle,
    ),
    {
      density: physics?.physicsBody.body === "dynamic" ? Math.max(physics.physicsBody.density, 0) : 0,
      friction: object.collider.friction,
      restitution: object.collider.restitution,
      isSensor: object.collider.sensor,
    },
  );
}

function bodyLocal(
  host: NonNullable<ReturnType<typeof transform>>,
  placement: NonNullable<ReturnType<typeof transform>>,
) {
  const radians = (-host.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = toMeters(placement.position.x - host.position.x);
  const dy = toMeters(placement.position.y - host.position.y);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
    angle: ((placement.rotation - host.rotation) * Math.PI) / 180,
  };
}

function applyGravity(object: PhysicsBody) {
  const body = simulated.get(object);
  if (!body || object.physicsBody.body !== "dynamic") return;
  const mass = body.getMass();
  if (!(mass > 0)) return;
  body.applyForceToCenter(Vec2(0, mass * object.physicsBody.gravity));
}

function writeBack(object: PhysicsBody) {
  const body = simulated.get(object);
  const placement = transform(object);
  if (!body || !placement || object.physicsBody.body === "static") return;

  const position = body.getPosition();
  placement.position.x = toPixels(position.x);
  placement.position.y = toPixels(position.y);
  placement.rotation = (body.getAngle() * 180) / Math.PI;

  const velocity = body.getLinearVelocity();
  object.physicsBody.velocity.x = toPixels(velocity.x);
  object.physicsBody.velocity.y = toPixels(velocity.y);
}
