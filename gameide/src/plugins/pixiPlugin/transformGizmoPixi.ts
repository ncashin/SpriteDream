import { Graphics } from "pixi.js";
import type { TransformGizmoTool } from "../editorPlugin/transformGizmoTool.js";

export type MoveGizmoHit = "none" | "x" | "y" | "xy";
export type RotateGizmoHit = "none" | "z";
export type ScaleGizmoHit = "none" | "x" | "y" | "xy";

const X_COLOR = 0xff3838;
const Y_COLOR = 0x42e042;
const XY_COLOR = 0xffee55;
const ROTATE_COLOR = 0x6ab0ff;
/** Uniform scale corner square; also used for sprite selection outline. */
export const UNIFORM_SCALE_COLOR = 0xcc66ee;
const OUTLINE = 0x1a1a1a;
const PIVOT_COLOR = 0xffffff;

/**
 * Planar XY / uniform-scale handle in +X,+Y: inner `inset` from pivot, then `size` square side.
 * Values are abstract "gizmo pixels" (multiply by `u`).
 */
const CORNER_SQUARE_INSET_GIZMO_PX = 2;
const CORNER_SQUARE_GIZMO_PX = 20;
/** Axis hits win when this close to a shaft inside the corner square (narrow strip on each axis). */
const CORNER_AXIS_TIGHT_GIZMO_PX = 4;
/** Clicks past this inset from each axis count as definite planar drag. */
const CORNER_PLANAR_INNER_GIZMO_PX = 12;

/** World units ~per screen pixel (gizmo stays visually constant size while zooming). */
export function gizmoWorldPerPixel(viewportScale: number): number {
  return 1 / Math.max(viewportScale, 1e-6);
}

function distPointSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * abx;
  const qy = ay + t * aby;
  return Math.hypot(px - qx, py - qy);
}

function pointInTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): boolean {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  const neg = s1 < 0 || s2 < 0 || s3 < 0;
  const pos = s1 > 0 || s2 > 0 || s3 > 0;
  return !(neg && pos);
}

function pointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function cornerSquareLayout(u: number): {
  inset: number;
  size: number;
  outer: number;
} {
  const inset = CORNER_SQUARE_INSET_GIZMO_PX * u;
  const size = CORNER_SQUARE_GIZMO_PX * u;
  return { inset, size, outer: inset + size };
}

function inCornerSquare(lx: number, ly: number, u: number): boolean {
  const { inset, size } = cornerSquareLayout(u);
  return (
    lx >= inset && lx <= inset + size && ly >= inset && ly <= inset + size
  );
}

/** Move: higher-contrast arrows + planar square. */
export function hitTestMoveGizmo(
  worldX: number,
  worldY: number,
  pivotX: number,
  pivotY: number,
  viewportScale: number,
): MoveGizmoHit {
  const u = gizmoWorldPerPixel(viewportScale);
  const lx = worldX - pivotX;
  const ly = worldY - pivotY;

  const shaftLen = 70 * u;
  const headLen = 18 * u;
  const headHalfW = 9 * u;
  const strokeHit = 11 * u;
  const { outer } = cornerSquareLayout(u);
  const tight = CORNER_AXIS_TIGHT_GIZMO_PX * u;
  const planarInner = CORNER_PLANAR_INNER_GIZMO_PX * u;

  if (inCornerSquare(lx, ly, u) && lx > planarInner && ly > planarInner) {
    return "xy";
  }

  const xTip = pointInTriangle(
    lx,
    ly,
    shaftLen,
    0,
    shaftLen - headLen,
    -headHalfW,
    shaftLen - headLen,
    headHalfW,
  );
  const xShaftNearPivot = lx >= 0 && lx <= outer && Math.abs(ly) <= tight;
  const xShaftOuter =
    distPointSegment(lx, ly, outer, 0, shaftLen, 0) <= strokeHit;
  if (xTip || xShaftNearPivot || xShaftOuter) {
    return "x";
  }

  const yTip = pointInTriangle(
    lx,
    ly,
    0,
    shaftLen,
    -headHalfW,
    shaftLen - headLen,
    headHalfW,
    shaftLen - headLen,
  );
  const yShaftNearPivot = ly >= 0 && ly <= outer && Math.abs(lx) <= tight;
  const yShaftOuter =
    distPointSegment(lx, ly, 0, outer, 0, shaftLen) <= strokeHit;
  if (yTip || yShaftNearPivot || yShaftOuter) {
    return "y";
  }

  if (inCornerSquare(lx, ly, u)) {
    return "xy";
  }

  return "none";
}

function strokeLineRounded(
  g: Graphics,
  width: number,
  color: number,
  alpha: number,
): void {
  g.stroke({ width, color, alpha, cap: "round", join: "round" });
}

function drawArrowAxis(
  g: Graphics,
  u: number,
  alongX: boolean,
  color: number,
  dim: boolean,
): void {
  const alpha = dim ? 0.38 : 1;
  const alphaLine = dim ? 0.42 : 1;
  const shaftLen = 70 * u;
  const headLen = 18 * u;
  const headHalfW = 9 * u;
  const lineW = Math.max(2 * u, 1.1);
  const outlineW = Math.max(2.6 * u, 1.35);

  if (alongX) {
    g.moveTo(0, 0);
    g.lineTo(shaftLen, 0);
    strokeLineRounded(g, outlineW, OUTLINE, alphaLine * 0.95);
    g.moveTo(0, 0);
    g.lineTo(shaftLen, 0);
    strokeLineRounded(g, lineW, color, alphaLine);

    g.moveTo(shaftLen + headLen * 0.02, 0);
    g.lineTo(shaftLen - headLen * 0.92, -headHalfW * 0.95);
    g.lineTo(shaftLen - headLen * 0.92, headHalfW * 0.95);
    g.closePath();
    g.fill({ color: OUTLINE, alpha: alpha * 0.9 });
    g.moveTo(shaftLen + headLen * 0.02, 0);
    g.lineTo(shaftLen - headLen * 0.92, -headHalfW * 0.95);
    g.lineTo(shaftLen - headLen * 0.92, headHalfW * 0.95);
    g.closePath();
    g.fill({ color, alpha });
  } else {
    g.moveTo(0, 0);
    g.lineTo(0, shaftLen);
    strokeLineRounded(g, outlineW, OUTLINE, alphaLine * 0.95);
    g.moveTo(0, 0);
    g.lineTo(0, shaftLen);
    strokeLineRounded(g, lineW, color, alphaLine);

    g.moveTo(0, shaftLen + headLen * 0.02);
    g.lineTo(-headHalfW * 0.95, shaftLen - headLen * 0.92);
    g.lineTo(headHalfW * 0.95, shaftLen - headLen * 0.92);
    g.closePath();
    g.fill({ color: OUTLINE, alpha: alpha * 0.9 });
    g.moveTo(0, shaftLen + headLen * 0.02);
    g.lineTo(-headHalfW * 0.95, shaftLen - headLen * 0.92);
    g.lineTo(headHalfW * 0.95, shaftLen - headLen * 0.92);
    g.closePath();
    g.fill({ color, alpha });
  }
}

export function drawMoveGizmo(
  g: Graphics,
  viewportScale: number,
  hover: MoveGizmoHit,
): void {
  g.clear();
  const u = gizmoWorldPerPixel(viewportScale);
  const { inset, size } = cornerSquareLayout(u);
  const sq0 = inset;
  const sqS = size;

  const dimX = hover !== "none" && hover !== "x";
  const dimY = hover !== "none" && hover !== "y";
  const dimXy = hover !== "none" && hover !== "xy";

  drawArrowAxis(g, u, true, X_COLOR, dimX);
  drawArrowAxis(g, u, false, Y_COLOR, dimY);

  g.rect(sq0, sq0, sqS, sqS);
  g.stroke({
    width: Math.max(2 * u, 1.05),
    color: OUTLINE,
    alpha: dimXy ? 0.35 : 0.88,
  });
  g.rect(sq0, sq0, sqS, sqS);
  g.stroke({
    width: Math.max(1.5 * u, 0.95),
    color: XY_COLOR,
    alpha: dimXy ? 0.4 : 0.98,
  });
  g.rect(sq0, sq0, sqS, sqS);
  g.fill({ color: XY_COLOR, alpha: dimXy ? 0.1 : 0.32 });

  const dotR = 3.75 * u;
  g.circle(0, 0, dotR + 1.1 * u);
  g.fill({ color: OUTLINE, alpha: 0.85 });
  g.circle(0, 0, dotR);
  g.fill({ color: PIVOT_COLOR, alpha: 0.98 });
}

/** 2D rotate: single Z ring (scene +Y up). */
export function hitTestRotateGizmo(
  worldX: number,
  worldY: number,
  pivotX: number,
  pivotY: number,
  viewportScale: number,
): RotateGizmoHit {
  const u = gizmoWorldPerPixel(viewportScale);
  const lx = worldX - pivotX;
  const ly = worldY - pivotY;
  const R = 58 * u;
  const tol = 12 * u;
  const d = Math.hypot(lx, ly);
  if (Math.abs(d - R) <= tol) return "z";
  return "none";
}

export function drawRotateGizmo(
  g: Graphics,
  viewportScale: number,
  hover: RotateGizmoHit,
): void {
  g.clear();
  const u = gizmoWorldPerPixel(viewportScale);
  const R = 58 * u;
  const dim = hover !== "none" && hover !== "z";
  const ringA = dim ? 0.45 : 1;

  g.circle(0, 0, R + 2.2 * u);
  g.stroke({
    width: Math.max(2.8 * u, 1.35),
    color: OUTLINE,
    alpha: 0.9 * ringA,
    cap: "round",
  });

  const seg = 1.15;
  g.arc(0, 0, R, -0.15, seg * 0.72, false);
  g.stroke({
    width: Math.max(2.25 * u, 1.1),
    color: X_COLOR,
    alpha: 0.75 * ringA,
    cap: "round",
  });
  g.arc(0, 0, R, Math.PI / 2 - seg * 0.72 - 0.02, Math.PI / 2 + 0.2, false);
  g.stroke({
    width: Math.max(2.25 * u, 1.1),
    color: Y_COLOR,
    alpha: 0.72 * ringA,
    cap: "round",
  });

  g.circle(0, 0, R);
  g.stroke({
    width: Math.max(2.4 * u, 1.15),
    color: ROTATE_COLOR,
    alpha: ringA,
    cap: "round",
  });

  const dotR = 3.5 * u;
  g.circle(0, 0, dotR + 1 * u);
  g.fill({ color: OUTLINE, alpha: 0.85 });
  g.circle(0, 0, dotR);
  g.fill({ color: PIVOT_COLOR, alpha: 0.98 });
}

/** Scale: axis cubes + uniform square (Blender-like). */
export function hitTestScaleGizmo(
  worldX: number,
  worldY: number,
  pivotX: number,
  pivotY: number,
  viewportScale: number,
): ScaleGizmoHit {
  const u = gizmoWorldPerPixel(viewportScale);
  const lx = worldX - pivotX;
  const ly = worldY - pivotY;

  const shaftLen = 68 * u;
  const ch = 8 * u;
  const strokeHit = 10 * u;
  const { outer } = cornerSquareLayout(u);
  const tight = CORNER_AXIS_TIGHT_GIZMO_PX * u;
  const planarInner = CORNER_PLANAR_INNER_GIZMO_PX * u;
  const xStemEnd = shaftLen - ch * 1.05;

  if (inCornerSquare(lx, ly, u) && lx > planarInner && ly > planarInner) {
    return "xy";
  }

  const xCubeLeft = shaftLen - ch;
  const xCubeRight = shaftLen + ch;
  const yCubeBottom = shaftLen - ch;
  const yCubeTop = shaftLen + ch;
  if (pointInRect(lx, ly, xCubeLeft, -ch, xCubeRight - xCubeLeft, 2 * ch)) {
    return "x";
  }
  if (pointInRect(lx, ly, -ch, yCubeBottom, 2 * ch, yCubeTop - yCubeBottom)) {
    return "y";
  }

  const xShaftNearPivot = lx >= 0 && lx <= outer && Math.abs(ly) <= tight;
  const xShaftOuter =
    distPointSegment(lx, ly, outer, 0, xStemEnd, 0) <= strokeHit;
  if (xShaftNearPivot || xShaftOuter) {
    return "x";
  }

  const yShaftNearPivot = ly >= 0 && ly <= outer && Math.abs(lx) <= tight;
  const yShaftOuter =
    distPointSegment(lx, ly, 0, outer, 0, xStemEnd) <= strokeHit;
  if (yShaftNearPivot || yShaftOuter) {
    return "y";
  }

  if (inCornerSquare(lx, ly, u)) {
    return "xy";
  }

  return "none";
}

function strokeSquareCap(g: Graphics, width: number, color: number, alpha: number): void {
  g.stroke({ width, color, alpha, cap: "square", join: "miter" });
}

function strokeScaleAxis(
  g: Graphics,
  u: number,
  alongX: boolean,
  color: number,
  dim: boolean,
): void {
  const alphaLine = dim ? 0.4 : 1;
  const shaftLen = 68 * u;
  const ch = 8 * u;
  const lineW = Math.max(2 * u, 1.1);
  const outlineW = Math.max(2.6 * u, 1.35);

  if (alongX) {
    g.moveTo(0, 0);
    g.lineTo(shaftLen - ch, 0);
    strokeSquareCap(g, outlineW, OUTLINE, alphaLine * 0.94);
    g.moveTo(0, 0);
    g.lineTo(shaftLen - ch, 0);
    strokeSquareCap(g, lineW, color, alphaLine);

    const cx = shaftLen - ch / 5;
    g.roundRect(cx - ch, -ch, 2 * ch, 2 * ch, 1.75 * u);
    g.fill({ color: OUTLINE, alpha: 0.9 * alphaLine });
    g.roundRect(cx - ch + u * 0.35, -ch + u * 0.35, 2 * ch - 0.7 * u, 2 * ch - 0.7 * u, 1.25 * u);
    g.fill({ color, alpha: 0.95 * alphaLine });
  } else {
    g.moveTo(0, 0);
    g.lineTo(0, shaftLen - ch);
    strokeSquareCap(g, outlineW, OUTLINE, alphaLine * 0.94);
    g.moveTo(0, 0);
    g.lineTo(0, shaftLen - ch);
    strokeSquareCap(g, lineW, color, alphaLine);

    const cy = shaftLen - ch / 5;
    g.roundRect(-ch, cy - ch, 2 * ch, 2 * ch, 1.75 * u);
    g.fill({ color: OUTLINE, alpha: 0.9 * alphaLine });
    g.roundRect(-ch + u * 0.35, cy - ch + u * 0.35, 2 * ch - 0.7 * u, 2 * ch - 0.7 * u, 1.25 * u);
    g.fill({ color, alpha: 0.95 * alphaLine });
  }
}

export function drawScaleGizmo(
  g: Graphics,
  viewportScale: number,
  hover: ScaleGizmoHit,
): void {
  g.clear();
  const u = gizmoWorldPerPixel(viewportScale);
  const { inset, size } = cornerSquareLayout(u);
  const sq0 = inset;
  const sqS = size;

  const dimX = hover !== "none" && hover !== "x";
  const dimY = hover !== "none" && hover !== "y";
  const dimXy = hover !== "none" && hover !== "xy";

  strokeScaleAxis(g, u, true, X_COLOR, dimX);
  strokeScaleAxis(g, u, false, Y_COLOR, dimY);

  g.rect(sq0, sq0, sqS, sqS);
  g.stroke({
    width: Math.max(2 * u, 1.05),
    color: OUTLINE,
    alpha: dimXy ? 0.35 : 0.88,
  });
  g.rect(sq0, sq0, sqS, sqS);
  g.stroke({
    width: Math.max(1.5 * u, 0.95),
    color: UNIFORM_SCALE_COLOR,
    alpha: dimXy ? 0.42 : 0.98,
  });
  g.rect(sq0, sq0, sqS, sqS);
  g.fill({ color: UNIFORM_SCALE_COLOR, alpha: dimXy ? 0.12 : 0.28 });

  const dotR = 3.75 * u;
  g.circle(0, 0, dotR + 1.1 * u);
  g.fill({ color: OUTLINE, alpha: 0.85 });
  g.circle(0, 0, dotR);
  g.fill({ color: PIVOT_COLOR, alpha: 0.98 });
}

export function drawActiveTransformGizmo(
  g: Graphics,
  viewportScale: number,
  tool: TransformGizmoTool,
  moveHover: MoveGizmoHit,
  rotateHover: RotateGizmoHit,
  scaleHover: ScaleGizmoHit,
): void {
  switch (tool) {
    case "translate":
      drawMoveGizmo(g, viewportScale, moveHover);
      break;
    case "rotate":
      drawRotateGizmo(g, viewportScale, rotateHover);
      break;
    case "scale":
      drawScaleGizmo(g, viewportScale, scaleHover);
      break;
    default: {
      const _check: never = tool;
      void _check;
    }
  }
}
