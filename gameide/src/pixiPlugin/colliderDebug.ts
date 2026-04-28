import { Graphics, Matrix, type Container } from "pixi.js";
import { getScene } from "../scene/scene.js";
import { query } from "../scene/query/query.js";
import type { BaseSceneObject } from "../scene/scene.js";

export type ColliderDebugOptions = {
  /** Stroke for non-trigger box/circle. Default `0x33ff66`. */
  solidColor?: number;
  /** Stroke for `isTrigger: true`. Default `0xffaa33`. */
  triggerColor?: number;
  lineWidth?: number;
  /**
   * Draw above sprites in the world container when {@link Container.sortableChildren} is on.
   * @default 1_000_000
   */
  zIndex?: number;
};

const DEFAULT_SOLID = 0x33ff66;
const DEFAULT_TRIGGER = 0xffaa33;

function isColliderNode(v: unknown): v is BaseSceneObject {
  if (!v || typeof v !== "object") return false;
  return "boxCollider" in v || "circleCollider" in v;
}

function sceneToPixi(x: number, y: number): { x: number; y: number } {
  return { x, y };
}

type BoxSpec = { width: number; height: number; isTrigger: boolean; ox: number; oy: number };
type CircleSpec = { radius: number; isTrigger: boolean; ox: number; oy: number };

function readBox(
  o: { boxCollider?: Record<string, unknown> },
): BoxSpec | null {
  const b = o.boxCollider;
  if (!b || typeof b !== "object") return null;
  const w = Number(b.width);
  const h = Number(b.height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  const off = (b.offset as { x?: number; y?: number } | undefined) ?? {};
  return {
    width: w,
    height: h,
    isTrigger: Boolean(b.isTrigger),
    ox: Number(off.x) || 0,
    oy: Number(off.y) || 0,
  };
}

function readCircle(
  o: { circleCollider?: Record<string, unknown> },
): CircleSpec | null {
  const c = o.circleCollider;
  if (!c || typeof c !== "object") return null;
  const r = Number(c.radius);
  if (!Number.isFinite(r) || r <= 0) return null;
  const off = (c.offset as { x?: number; y?: number } | undefined) ?? {};
  return {
    radius: r,
    isTrigger: Boolean(c.isTrigger),
    ox: Number(off.x) || 0,
    oy: Number(off.y) || 0,
  };
}

function rotateScenePoint(ox: number, oy: number, angle: number): { x: number; y: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * ox - s * oy, y: s * ox + c * oy };
}

/**
 * Renders `boxCollider` / `circleCollider` outlines in world space to match
 * the Planck `planckPlugin` (scene +Y = up; transform position + rotation z).
 */
export function syncColliderDebugDraw(
  world: Container,
  graphics: Graphics,
  options: ColliderDebugOptions = {},
): void {
  if (!graphics.parent) {
    world.addChild(graphics);
  }

  const solidColor = options.solidColor ?? DEFAULT_SOLID;
  const triggerColor = options.triggerColor ?? DEFAULT_TRIGGER;
  const lineWidth = options.lineWidth ?? 1.5;
  const z = options.zIndex ?? 1_000_000;
  graphics.zIndex = z;
  graphics.clear();

  const colliders = query(getScene(), isColliderNode);
  for (const obj of colliders) {
    const pos = (obj as { position?: { x: number; y: number } }).position;
    if (!pos) continue;
    const rotZ = (obj as { rotation?: { z: number } }).rotation?.z ?? 0;
    const box = readBox(obj);
    const circ = readCircle(obj);
    if (box) {
      const hw = box.width / 2;
      const hh = box.height / 2;
      const base = [
        { x: box.ox - hw, y: box.oy - hh },
        { x: box.ox + hw, y: box.oy - hh },
        { x: box.ox + hw, y: box.oy + hh },
        { x: box.ox - hw, y: box.oy + hh },
      ];
      const m = new Matrix();
      m.rotate(rotZ);
      const first = m.apply(base[0]!);
      const w0 = first.x + pos.x;
      const w1 = first.y + pos.y;
      const p0 = sceneToPixi(w0, w1);
      graphics.moveTo(p0.x, p0.y);
      for (let i = 1; i < 4; i++) {
        const r = m.apply(base[i]!);
        const w = sceneToPixi(r.x + pos.x, r.y + pos.y);
        graphics.lineTo(w.x, w.y);
      }
      graphics.closePath();
      const color = box.isTrigger ? triggerColor : solidColor;
      graphics.stroke({ width: lineWidth, color, alpha: 0.95 });
    } else if (circ) {
      const off = rotateScenePoint(circ.ox, circ.oy, rotZ);
      const cx = pos.x + off.x;
      const cy = pos.y + off.y;
      const p = sceneToPixi(cx, cy);
      const color = circ.isTrigger ? triggerColor : solidColor;
      graphics.circle(p.x, p.y, circ.radius);
      graphics.stroke({ width: lineWidth, color, alpha: 0.95 });
    }
  }
}

export function createColliderDebugGraphics(
  world: Container,
  options: ColliderDebugOptions = {},
): Graphics {
  const g = new Graphics();
  g.label = "gameide:colliderDebug";
  g.zIndex = options.zIndex ?? 1_000_000;
  g.eventMode = "none";
  world.addChild(g);
  return g;
}

export function destroyColliderDebugGraphics(graphics: Graphics, world: Container): void {
  if (graphics.parent === world) {
    world.removeChild(graphics);
  }
  graphics.destroy();
}
