import { Container, Graphics } from "pixi.js";
import { getScene, type GameObject } from "gameide";
import {
  collisionBodyDisabled,
  isColliderNode,
} from "../planckPlugin/planckBodies.js";

type ColliderDebugBinding = {
  root: Container;
  outline: Graphics;
};

function hasColliderTransform(object: GameObject): boolean {
  return (
    !!(object as { position?: unknown }).position &&
    !!(object as { rotation?: unknown }).rotation
  );
}

function readTransformForDebug(object: GameObject): {
  x: number;
  y: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
} {
  const pos = (object as { position?: { x?: number; y?: number } }).position;
  const rot = (object as { rotation?: { z?: number } }).rotation;
  const scale = (object as { scale?: { x?: number; y?: number } }).scale;
  return {
    x: pos?.x ?? 0,
    y: pos?.y ?? 0,
    rotationZ: rot?.z ?? 0,
    scaleX: scale?.x ?? 1,
    scaleY: scale?.y ?? 1,
  };
}

function redrawColliderOutline(outline: Graphics, entity: GameObject): void {
  outline.clear();

  const box = (entity as { boxCollider?: { width?: unknown; height?: unknown; offset?: { x?: number; y?: number } } })
    .boxCollider;
  const circle = (
    entity as { circleCollider?: { radius?: unknown; offset?: { x?: number; y?: number } } }
  ).circleCollider;

  const disabled = collisionBodyDisabled(entity);

  const color = disabled ? 0x888888 : 0x44dd66;
  const alpha = disabled ? 0.4 : 0.95;

  if (box && typeof box === "object") {
    const w = Math.max(1e-6, Number(box.width) || 0);
    const h = Math.max(1e-6, Number(box.height) || 0);
    const ox = Number(box.offset?.x) || 0;
    const oy = Number(box.offset?.y) || 0;
    outline
      .rect(ox - w / 2, oy - h / 2, w, h)
      .stroke({ width: 1, color, alpha, pixelLine: true });
    return;
  }

  if (circle && typeof circle === "object") {
    const r = Math.max(1e-6, Number(circle.radius) || 0);
    const ox = Number(circle.offset?.x) || 0;
    const oy = Number(circle.offset?.y) || 0;
    outline
      .circle(ox, oy, r)
      .stroke({ width: 1, color, alpha, pixelLine: true });
  }
}

function syncColliderDebugBinding(binding: ColliderDebugBinding, entity: GameObject): void {
  const t = readTransformForDebug(entity);
  binding.root.position.set(t.x, t.y);
  binding.root.rotation = t.rotationZ;
  binding.root.scale.set(t.scaleX, -t.scaleY);
  redrawColliderOutline(binding.outline, entity);
}

export type ColliderDebugOptions = {
  /** Draw order within the Pixi stage; higher draws above sprites. */
  zIndex?: number;
};

/**
 * Subscribes to the scene and draws 2D collider outlines in **scene pixel units**
 * (same numbers as `boxCollider` / `circleCollider` traits). No pixels-per-meter
 * conversion — this is for visual debugging aligned with sprite space.
 */
export function colliderDebug(
  stage: Container,
  options: ColliderDebugOptions = {},
): { unsubscribe: () => void } {
  const zIndex = options.zIndex ?? 10_000;
  const scene = getScene();
  const bindingsBySceneKey = new Map<PropertyKey, ColliderDebugBinding>();

  function removeBindingIfPresent(sceneRootKey: PropertyKey): void {
    const existing = bindingsBySceneKey.get(sceneRootKey);
    if (!existing) return;
    existing.root.destroy({ children: true });
    bindingsBySceneKey.delete(sceneRootKey);
  }

  function reconcileSceneRootKey(sceneRootKey: PropertyKey): void {
    const rawNode = Reflect.get(scene.getRaw(), sceneRootKey);
    if (rawNode === undefined || !isColliderNode(rawNode)) {
      removeBindingIfPresent(sceneRootKey);
      return;
    }

    const live = Reflect.get(scene.get(), sceneRootKey) as GameObject;
    if (!hasColliderTransform(live)) {
      removeBindingIfPresent(sceneRootKey);
      return;
    }

    let binding = bindingsBySceneKey.get(sceneRootKey);
    if (!binding) {
      const root = new Container();
      root.label = `gameide:collider-debug:${String(sceneRootKey)}`;
      root.eventMode = "none";
      root.zIndex = zIndex;
      const outline = new Graphics();
      outline.eventMode = "none";
      root.addChild(outline);
      stage.addChild(root);
      binding = { root, outline };
      bindingsBySceneKey.set(sceneRootKey, binding);
    }

    syncColliderDebugBinding(binding, live);
  }

  for (const key of Reflect.ownKeys(scene.getRaw())) {
    reconcileSceneRootKey(key);
  }

  const unsubscribe = scene.onChange((_target, mutationPathTrail) => {
    const anchoredRootKey = mutationPathTrail[0];
    if (anchoredRootKey === undefined) return;
    reconcileSceneRootKey(anchoredRootKey);
  });

  return { unsubscribe };
}
