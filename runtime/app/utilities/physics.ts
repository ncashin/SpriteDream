import Atom from "lucide/dist/esm/icons/atom.mjs";
import Square from "lucide/dist/esm/icons/square.mjs";
import { BoxShape, Vec2, World, type Body, type Contact } from "planck";
import { defaulted, enum_, object } from "remix/data-schema";
import { boolean, number } from "remix/data-schema/coerce";

import { addBoundingBoxLookup } from "./bounding-box.ts";
import { isObject } from "./is-object.ts";
import { filterScene, scene, type SceneNode } from "./scene.ts";
import { defineTrait } from "./trait/trait.ts";
import "./viewport/draw-image.ts";
import { parentObject, transform } from "./viewport/transform.ts";

const bodyTypes = ["static", "kinematic", "dynamic"] as const;

export const colliderTrait = defineTrait(
  "Collider",
  Square,
  object({
    width: defaulted(number(), 64),
    height: defaulted(number(), 64),
    friction: defaulted(number(), 0.3),
    restitution: defaulted(number(), 0),
    sensor: defaulted(boolean(), false),
    propagateCollision: defaulted(boolean(), false),
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
  const collider = colliderTrait(object);
  if (!collider) return;
  return {
    width: collider.collider.width,
    height: collider.collider.height,
    resizeCallback: ({ width, height }) => {
      collider.collider.width = width;
      collider.collider.height = height;
    },
  };
});

const pixelsPerMeter = 128;
const maxStep = 1 / 20;

function toMeters(pixels: number) {
  return pixels / pixelsPerMeter;
}

function toPixels(meters: number) {
  return meters * pixelsPerMeter;
}

type LocalPose = {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  spin: number;
  sceneX: number;
  sceneY: number;
  sceneAngle: number;
};

type HostedFixtures = {
  propagate: boolean;
  children: readonly SceneNode[];
  sizes: string;
  kind: string;
};

export type PhysicsContact = {
  a: SceneNode;
  b: SceneNode;
  normalY: number;
  touching: boolean;
};

export function physics() {
  const world = new World(Vec2(0, 0));
  const simulated = new Map<SceneNode, Body>();
  const hostedFixtures = new Map<SceneNode, HostedFixtures>();
  const localPose = new Map<SceneNode, LocalPose>();
  const touched = new Set<SceneNode>();
  const contacts = new Set<Contact>();
  let frameDelta = 0;
  let stepping = false;

  world.on("begin-contact", (contact) => {
    contacts.add(contact);
  });
  world.on("end-contact", (contact) => {
    contacts.delete(contact);
  });

  function beginFrame(deltaTime: number) {
    frameDelta = deltaTime;
    stepping = deltaTime > 0;
    touched.clear();
  }

  function simulate(object: SceneNode) {
    if (!stepping) return;
    if (hostedCollider(object)) return;
    if (!physicsBodyTrait(object) && !colliderTrait(object)) return;

    touched.add(object);
    if (simulated.has(object) && fixturesStale(object)) {
      world.destroyBody(simulated.get(object)!);
      simulated.delete(object);
      hostedFixtures.delete(object);
      localPose.delete(object);
    }
    if (!simulated.has(object)) createBody(object);
    else syncFromScene(object, frameDelta);
  }

  function endFrame() {
    if (!stepping) return;

    for (const [object, body] of simulated) {
      if (touched.has(object)) continue;
      world.destroyBody(body);
      simulated.delete(object);
      hostedFixtures.delete(object);
      localPose.delete(object);
    }

    for (const object of touched) {
      const body = physicsBodyTrait(object);
      if (body) applyGravity(body);
      if (colliderTrait(object)) applySeparatedGravity(object);
    }

    world.step(Math.min(frameDelta, maxStep), 8, 3);

    for (const object of touched) {
      const body = physicsBodyTrait(object);
      if (body) writeBack(body);
      if (colliderTrait(object)) writeSeparatedCollider(object);
    }
  }

  function createBody(object: SceneNode) {
  const placement = transform(object);
  if (!placement) return;

  const physics = physicsBodyTrait(object);
  const collider = colliderTrait(object);
  const separated = separatedCollider(object);
  const body = world.createBody({
    type: physics?.physicsBody.body ?? (separated ? "dynamic" : "static"),
    position: Vec2(toMeters(placement.position.x), toMeters(placement.position.y)),
    angle: (placement.rotation * Math.PI) / 180,
    fixedRotation: physics?.physicsBody.fixedRotation ?? false,
    gravityScale: separated ? 0 : 1,
    userData: object,
  });
  const children = propagatedColliders(object);
  if (collider) addColliderFixture(body, collider, object);
  for (const child of children) addColliderFixture(body, child, object);
  hostedFixtures.set(object, {
    propagate: propagatesCollision(object),
    children,
    sizes: fixtureSizes(object, children),
    kind: bodyKind(object),
  });
  if (separated) rememberLocalPose(object);
  const velocity = physics?.physicsBody.velocity;
  if (velocity) body.setLinearVelocity(Vec2(toMeters(velocity.x), toMeters(velocity.y)));
  simulated.set(object, body);
}

function syncFromScene(object: SceneNode, deltaTime: number) {
  const body = simulated.get(object);
  const placement = transform(object);
  if (!body || !placement) return;

  if (separatedCollider(object)) {
    placeWithParent(object, body);
    return;
  }
  const position = Vec2(toMeters(placement.position.x), toMeters(placement.position.y));
  const angle = (placement.rotation * Math.PI) / 180;
  const previous = body.getPosition();
  const previousAngle = body.getAngle();
  const moved =
    Math.abs(position.x - previous.x) > 1e-4 ||
    Math.abs(position.y - previous.y) > 1e-4 ||
    Math.abs(angle - previousAngle) > 1e-4;
  const physics = physicsBodyTrait(object)?.physicsBody;
  if (physics?.body === "kinematic" && moved) {
    const vx = (position.x - previous.x) / deltaTime;
    const vy = (position.y - previous.y) / deltaTime;
    const spin = (angle - previousAngle) / deltaTime;
    const snapped = Math.hypot(vx, vy) > toMeters(4000) || Math.abs(spin) > Math.PI * 8;
    body.setLinearVelocity(snapped ? Vec2(0, 0) : Vec2(vx, vy));
    body.setAngularVelocity(snapped ? 0 : spin);
  } else if (moved) {
    body.setAngularVelocity(0);
  }
  body.setTransform(position, angle);
  if (physics?.body === "dynamic") {
    body.setLinearVelocity(Vec2(toMeters(physics.velocity.x), toMeters(physics.velocity.y)));
  }
}

function fixturesStale(object: SceneNode) {
  const previous = hostedFixtures.get(object);
  if (!previous) return false;
  const children = propagatedColliders(object);
  if (previous.propagate !== propagatesCollision(object)) return true;
  if (previous.kind !== bodyKind(object)) return true;
  if (previous.sizes !== fixtureSizes(object, children)) return true;
  return previous.children.length !== children.length || previous.children.some((child, index) => child !== children[index]);
}

function fixtureSizes(object: SceneNode, children: readonly SceneNode[]) {
  return [object, ...children].map((node) => colliderLayout(object, node)).join("|");
}

function colliderLayout(host: SceneNode, object: SceneNode) {
  const size = colliderSize(object);
  const placement = transform(object);
  const hostPlacement = transform(host);
  if (!placement || !hostPlacement) return size;
  const local = bodyLocal(hostPlacement, placement);
  return `${size},${round(placement.scale.x)},${round(placement.scale.y)}@${round(local.x)},${round(local.y)},${round(local.angle)}`;
}

function round(value: number) {
  return Math.round(value * 1e4) / 1e4;
}

function bodyKind(object: SceneNode) {
  const physics = physicsBodyTrait(object)?.physicsBody;
  if (!physics) return separatedCollider(object) ? "separated" : "static";
  return `${physics.body},${physics.fixedRotation},${physics.density}`;
}

function colliderSize(object: SceneNode) {
  const collider = colliderTrait(object)?.collider;
  if (!collider) return "";
  return `${collider.width},${collider.height}`;
}

function propagatesCollision(object: SceneNode) {
  return colliderTrait(object)?.collider.propagateCollision === true;
}

function hostedCollider(object: SceneNode) {
  return Boolean(colliderTrait(object) && collisionHost(object));
}

function collisionHost(object: SceneNode): SceneNode | undefined {
  const parent = parentObject(object);
  if (!parent) return;
  const higher = collisionHost(parent);
  if (higher) return higher;
  if (propagatesCollision(parent) && (physicsBodyTrait(parent) || colliderTrait(parent))) return parent;
}

function separatedCollider(object: SceneNode) {
  return Boolean(colliderTrait(object) && !physicsBodyTrait(object) && parentObject(object) && !hostedCollider(object));
}

function carrierBody(object: SceneNode) {
  const seen = new Set<SceneNode>();
  let current = parentObject(object);
  while (current && !seen.has(current)) {
    const body = simulated.get(current);
    if (body) return body;
    seen.add(current);
    current = parentObject(current);
  }
}

function sceneLocalPose(object: SceneNode) {
  const placement = transform(object);
  const parent = parentObject(object);
  const parentPlacement = parent ? transform(parent) : undefined;
  if (!placement || !parentPlacement) return;
  const local = bodyLocal(parentPlacement, placement);
  return { x: local.x, y: local.y, angle: local.angle };
}

function rememberLocalPose(object: SceneNode) {
  const local = sceneLocalPose(object);
  if (!local) return;
  localPose.set(object, { ...local, vx: 0, vy: 0, spin: 0, sceneX: local.x, sceneY: local.y, sceneAngle: local.angle });
}

function adoptEditedPose(object: SceneNode) {
  const local = localPose.get(object);
  const scene = sceneLocalPose(object);
  if (!local || !scene) return;
  const moved =
    Math.abs(scene.x - local.sceneX) > 1e-4 ||
    Math.abs(scene.y - local.sceneY) > 1e-4 ||
    Math.abs(scene.angle - local.sceneAngle) > 1e-4;
  if (!moved) return;
  local.x = scene.x;
  local.y = scene.y;
  local.angle = scene.angle;
  local.vx = 0;
  local.vy = 0;
  local.spin = 0;
  local.sceneX = scene.x;
  local.sceneY = scene.y;
  local.sceneAngle = scene.angle;
}

function placeWithParent(object: SceneNode, body: Body) {
  const parent = carrierBody(object);
  adoptEditedPose(object);
  const local = localPose.get(object);
  if (!parent || !local) return;
  const origin = parent.getPosition();
  const rotation = parent.getAngle();
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const velocity = parent.getLinearVelocity();
  const tangentX = -sin * local.x - cos * local.y;
  const tangentY = cos * local.x - sin * local.y;
  const spin = parent.getAngularVelocity();
  body.setLinearVelocity(
    Vec2(velocity.x + tangentX * spin + local.vx * cos - local.vy * sin, velocity.y + tangentY * spin + local.vx * sin + local.vy * cos),
  );
  body.setAngularVelocity(spin + local.spin);
  body.setTransform(
    Vec2(origin.x + local.x * cos - local.y * sin, origin.y + local.x * sin + local.y * cos),
    rotation + local.angle,
  );
}

function propagatedColliders(host: SceneNode) {
  return filterScene(scene, (node) => {
    if (!isObject(node) || collisionHost(node) !== host) return;
    return colliderTrait(node);
  });
}

function addColliderFixture(body: Body, object: Collider, host: SceneNode) {
  const placement = transform(object);
  const hostPlacement = transform(host);
  if (!placement || !hostPlacement) return;

  const width = toMeters(Math.abs(object.collider.width * placement.scale.x));
  const height = toMeters(Math.abs(object.collider.height * placement.scale.y));
  const local = bodyLocal(hostPlacement, placement);
  const physics = physicsBodyTrait(host);
  const dynamic = physics ? physics.physicsBody.body === "dynamic" : body.getType() === "dynamic";
  body.createFixture(
    BoxShape(
      Math.max(width, toMeters(1)) / 2,
      Math.max(height, toMeters(1)) / 2,
      Vec2(local.x, local.y),
      local.angle,
    ),
    {
      density: dynamic ? Math.max(physics?.physicsBody.density ?? 1, 0) : 0,
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

function writeSeparatedCollider(object: SceneNode) {
  if (!separatedCollider(object)) return;
  const body = simulated.get(object);
  const parent = carrierBody(object);
  const placement = transform(object);
  if (!body || !parent || !placement) return;

  const origin = parent.getPosition();
  const rotation = -parent.getAngle();
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const position = body.getPosition();
  const dx = position.x - origin.x;
  const dy = position.y - origin.y;
  const velocity = body.getLinearVelocity();
  const parentVelocity = parent.getLinearVelocity();
  const spin = parent.getAngularVelocity();
  const worldX = velocity.x - parentVelocity.x - (-Math.sin(parent.getAngle()) * dx - Math.cos(parent.getAngle()) * dy) * spin;
  const worldY = velocity.y - parentVelocity.y - (Math.cos(parent.getAngle()) * dx - Math.sin(parent.getAngle()) * dy) * spin;
  const next = {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
    angle: body.getAngle() - parent.getAngle(),
    vx: worldX * cos - worldY * sin,
    vy: worldX * sin + worldY * cos,
    spin: body.getAngularVelocity() - spin,
  };
  localPose.set(object, { ...next, sceneX: next.x, sceneY: next.y, sceneAngle: next.angle });

  const world = body.getPosition();
  placement.position.x = toPixels(world.x);
  placement.position.y = toPixels(world.y);
  placement.rotation = (body.getAngle() * 180) / Math.PI;
  const written = sceneLocalPose(object);
  const stored = localPose.get(object);
  if (written && stored) {
    stored.sceneX = written.x;
    stored.sceneY = written.y;
    stored.sceneAngle = written.angle;
  }
}

function applySeparatedGravity(object: SceneNode) {
  if (!separatedCollider(object)) return;
  const body = simulated.get(object);
  const carrier = carrierObject(object);
  const physics = carrier ? physicsBodyTrait(carrier) : undefined;
  if (!body || !physics || physics.physicsBody.body !== "dynamic") return;
  const mass = body.getMass();
  if (!(mass > 0)) return;
  body.applyForceToCenter(Vec2(0, mass * physics.physicsBody.gravity));
}

function carrierObject(object: SceneNode) {
  const seen = new Set<SceneNode>();
  let current = parentObject(object);
  while (current && !seen.has(current)) {
    if (simulated.has(current)) return current;
    seen.add(current);
    current = parentObject(current);
  }
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

  function contactList(): PhysicsContact[] {
    const list: PhysicsContact[] = [];
    for (const contact of contacts) {
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      const a = fixtureA.getBody().getUserData();
      const b = fixtureB.getBody().getUserData();
      if (!isSceneNode(a) || !isSceneNode(b)) continue;
      const manifold = contact.getWorldManifold(null);
      list.push({
        a,
        b,
        normalY: manifold?.normal.y ?? 0,
        touching: contact.isTouching() && !fixtureA.isSensor() && !fixtureB.isSensor(),
      });
    }
    return list;
  }

  return { beginFrame, simulate, endFrame, contacts: contactList };
}

function isSceneNode(value: unknown): value is SceneNode {
  return isObject(value);
}
