import { Application, Graphics } from "pixi.js";
import { update } from "../gameloop.js";
import { GameIDEMode, getMode } from "../mode.js";
import { createObjectGuard } from "../objectRegistry.js";
import type { SchemaToType } from "../objectRegistry.js";
import type { SceneObject } from "../scene.js";
import { getScene } from "../scene.js";
import { collider2D } from "../collisionPlugin2D/collider2D.js";
import { collisionBody2D } from "../collisionPlugin2D/collisionBody2D.js";
import { TransformDefinition2D } from "./transform.js";

type Transform2D = SchemaToType<typeof TransformDefinition2D>;
type Collider2D = SchemaToType<typeof collider2D>;
type CollisionBody2D = SchemaToType<typeof collisionBody2D>;
type ColliderEntity2D = Transform2D & Collider2D & CollisionBody2D;

const isTransform2D = createObjectGuard(TransformDefinition2D);
const isCollider2D = createObjectGuard(collider2D);
const isCollisionBody2D = createObjectGuard(collisionBody2D);

const isColliderEntity2D = (sceneObject: SceneObject): sceneObject is ColliderEntity2D =>
  isTransform2D(sceneObject) && isCollider2D(sceneObject) && isCollisionBody2D(sceneObject);

type ColliderDebugEntry = { graphics: Graphics };

function strokeStyleFor(entity: ColliderEntity2D) {
  const { collider2D: c, collisionBody2D: body } = entity;
  if (body.isStatic) return { width: 2, color: 0x64748b, alpha: 0.95 };
  if (c.isSensor) return { width: 2, color: 0x3b82f6, alpha: 0.95 };
  return { width: 2, color: 0x22c55e, alpha: 0.95 };
}

function redrawColliderDebug(entity: ColliderEntity2D, entry: ColliderDebugEntry): void {
  const { graphics } = entry;
  const { transform2D, collider2D: c } = entity;

  if (getMode() !== GameIDEMode.Editor) {
    graphics.visible = false;
    return;
  }

  graphics.visible = true;
  graphics.clear();
  graphics.position.set(transform2D.x, transform2D.y);
  graphics.rotation = transform2D.rotation;

  const stroke = strokeStyleFor(entity);
  if (c.shape === "circle") {
    graphics.circle(0, 0, c.radius);
    graphics.stroke(stroke);
  } else {
    graphics.rect(-c.width / 2, -c.height / 2, c.width, c.height);
    graphics.stroke(stroke);
  }
}

export function initializeColliderDebugRendering(app: Application): void {
  const scene = getScene();
  const registry = new Map<object, ColliderDebugEntry>();

  function attach(entity: object) {
    if (registry.has(entity)) return;
    const graphics = new Graphics();
    graphics.eventMode = "none";
    app.stage.addChild(graphics);
    registry.set(entity, { graphics });
  }

  function detach(entity: object) {
    const entry = registry.get(entity);
    if (!entry) return;
    entry.graphics.destroy();
    registry.delete(entity);
  }

  update(() => {
    const entities = scene.query({
      callback: isColliderEntity2D,
      cacheKey: "render2D-collider-debug",
    });
    const next = new Set<object>(entities);
    for (const [obj] of registry) {
      if (!next.has(obj)) detach(obj);
    }
    for (const entity of entities) {
      attach(entity);
      const entry = registry.get(entity);
      if (entry) redrawColliderDebug(entity, entry);
    }
  });
}
