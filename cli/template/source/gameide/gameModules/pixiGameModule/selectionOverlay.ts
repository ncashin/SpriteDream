import { Container, Graphics } from "pixi.js";
import {
  onEditorUpdate,
  selectedObject,
  type GameObject,
  type Scene,
} from "gameide";

export type SpriteBindingLike = {
  root: Container;
  innerSprite: { width: number; height: number };
};

function findTopLevelSceneKey(
  scene: Scene,
  object: GameObject,
): PropertyKey | undefined {
  const live = scene.get() as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(live)) {
    if (Reflect.get(live, key) === object) return key;
  }
  return undefined;
}

function readTransformForOverlay(object: GameObject): {
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

function drawColliderBoundsStroke(
  graphics: Graphics,
  entity: GameObject,
  strokeWidth: number,
): boolean {
  const box = (
    entity as {
      boxCollider?: { width?: unknown; height?: unknown; offset?: { x?: number; y?: number } };
    }
  ).boxCollider;
  const circle = (
    entity as { circleCollider?: { radius?: unknown; offset?: { x?: number; y?: number } } }
  ).circleCollider;

  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-highlight")
    .trim();
  const alpha = 1;

  if (box && typeof box === "object") {
    const w = Math.max(1e-6, Number(box.width) || 0);
    const h = Math.max(1e-6, Number(box.height) || 0);
    const ox = Number(box.offset?.x) || 0;
    const oy = Number(box.offset?.y) || 0;
    graphics
      .rect(ox - w / 2, oy - h / 2, w, h)
      .stroke({ width: strokeWidth, color, alpha, pixelLine: true });
    return true;
  }

  if (circle && typeof circle === "object") {
    const r = Math.max(1e-6, Number(circle.radius) || 0);
    const ox = Number(circle.offset?.x) || 0;
    const oy = Number(circle.offset?.y) || 0;
    graphics
      .circle(ox, oy, r)
      .stroke({ width: strokeWidth, color, alpha, pixelLine: true });
    return true;
  }

  return false;
}

export type SelectionOverlayOptions = {
  /** Draw above collider debug outlines. */
  zIndex?: number;
};

/**
 * Draws an amber outline around the selected scene object (sprite AABB or collider shape).
 */
export function selectionOverlay(
  stage: Container,
  scene: Scene,
  spriteBindingsBySceneKey: Map<PropertyKey, SpriteBindingLike>,
  options: SelectionOverlayOptions = {},
): { unsubscribe: () => void } {
  const zIndex = options.zIndex ?? 10_001;

  const root = new Container();
  root.label = "gameide:selection-overlay";
  root.eventMode = "none";
  root.zIndex = zIndex;
  const outline = new Graphics();
  outline.eventMode = "none";
  root.addChild(outline);
  stage.addChild(root);

  function sync(): void {
    outline.clear();
    const sel = selectedObject;
    if (!sel) {
      root.visible = false;
      return;
    }

    const key = findTopLevelSceneKey(scene, sel);
    if (key === undefined) {
      root.visible = false;
      return;
    }

    const t = readTransformForOverlay(sel);
    root.position.set(t.x, t.y);
    root.rotation = t.rotationZ;
    root.scale.set(t.scaleX, -t.scaleY);
    root.visible = true;

    const binding = spriteBindingsBySceneKey.get(key);
    const strokeWidth = 2;
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-highlight")
      .trim();
    const alpha = 1;

    if (binding) {
      const hw = binding.innerSprite.width / 2;
      const hh = binding.innerSprite.height / 2;
      outline
        .rect(-hw, -hh, hw * 2, hh * 2)
        .stroke({ width: strokeWidth, color, alpha, pixelLine: true });
      return;
    }

    const drewCollider = drawColliderBoundsStroke(outline, sel, strokeWidth);
    if (!drewCollider) {
      const fallback = 12;
      outline
        .rect(-fallback / 2, -fallback / 2, fallback, fallback)
        .stroke({ width: strokeWidth, color, alpha, pixelLine: true });
    }
  }

  sync();

  const unsubScene = scene.onChange((_target, mutationPathTrail) => {
    const anchoredRootKey = mutationPathTrail[0];
    if (anchoredRootKey === undefined) return;
    const sel = selectedObject;
    if (!sel) return;
    if (findTopLevelSceneKey(scene, sel) !== anchoredRootKey) return;
    sync();
  });

  const unsubEditorFrame = onEditorUpdate(sync);

  return {
    unsubscribe: () => {
      unsubScene();
      unsubEditorFrame();
      root.destroy({ children: true });
    },
  };
}
