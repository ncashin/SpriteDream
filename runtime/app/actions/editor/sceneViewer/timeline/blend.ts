import type { KeyFrameType } from "./KeyFrame.tsx";

export const blendModes = ["none", "linear", "lerp", "slerp", "bezier"] as const;

export type BlendMode = (typeof blendModes)[number];

export type BlendParam = {
  name: string;
  min: number;
  max: number;
  step?: number;
  labels?: readonly string[];
};

const easeParam: BlendParam = { name: "ease", min: 0, max: 2, step: 1, labels: ["in", "out", "in-out"] };

export const blendParams: Record<BlendMode, readonly BlendParam[]> = {
  none: [],
  linear: [],
  lerp: [{ name: "power", min: 1, max: 5 }, easeParam],
  slerp: [{ name: "power", min: 1, max: 5 }, easeParam, { name: "turns", min: -4, max: 4, step: 1 }],
  bezier: [],
};

export const blendDefaults: Record<BlendMode, readonly number[]> = {
  none: [],
  linear: [],
  lerp: [2, 2],
  slerp: [1, 0, 0],
  bezier: [],
};

export type Keyframe = { time: number; value: string; blend: BlendMode; params: number[] };

export function blendAt(type: KeyFrameType, keyframes: Keyframe[], time: number) {
  const first = keyframes[0];
  if (!first) {
    if (type === "color") return "transparent";
    if (type === "sound") return "";
    return "matrix(1, 0, 0, 1, 0, 0)";
  }
  let previous = first;
  for (let index = 0; index < keyframes.length; index++) {
    const frame = keyframes[index]!;
    if (frame.time >= time) {
      const span = frame.time - previous.time;
      const t = span === 0 ? 1 : (time - previous.time) / span;
      return blend(type, previous.value, frame.value, Math.min(1, Math.max(0, t)), previous.blend, previous.params);
    }
    previous = frame;
  }
  return previous.value;
}

function blend(type: KeyFrameType, from: string, to: string, t: number, mode: BlendMode, params: readonly number[]) {
  switch (type) {
    case "color":
      return blendColor(from, to, t, mode, params);
    case "transform":
      return blendTransform(from, to, t, mode, params);
    case "sound":
      return t < 1 ? from : to;
  }
}

export function blendAmount(t: number, mode: BlendMode, params: readonly number[]) {
  if (mode === "none") return 0;
  if (mode === "lerp" || mode === "slerp") return powerEase(t, params[0] ?? 1, params[1] ?? 0);
  if (mode === "bezier") return bezierAmount(t, params);
  return t;
}

function powerEase(t: number, power: number, ease: number) {
  const exponent = Math.min(5, Math.max(1, power));
  if (exponent === 1) return t;
  const kind = Math.round(Math.min(2, Math.max(0, ease)));
  if (kind === 0) return t ** exponent;
  if (kind === 1) return 1 - (1 - t) ** exponent;
  const scaled = 2 ** (exponent - 1);
  return t < 0.5 ? scaled * t ** exponent : 1 - scaled * (1 - t) ** exponent;
}

export type BezierHandle = { x: number; y: number };

export type BezierPoint = { x: number; y: number; left: BezierHandle; right: BezierHandle };

export function bezierPoints(params: readonly number[]): BezierPoint[] {
  const stride = params.length % 6 === 0 ? 6 : 2;
  const points: BezierPoint[] = [];
  for (let index = 0; index + 1 < params.length; index += stride) {
    const x = Math.min(0.98, Math.max(0.02, params[index] ?? 0.5));
    const y = params[index + 1] ?? 0;
    const left = stride === 6 ? { x: params[index + 2] ?? x - 0.12, y: params[index + 3] ?? y } : { x: x - 0.12, y };
    const right = stride === 6 ? { x: params[index + 4] ?? x + 0.12, y: params[index + 5] ?? y } : { x: x + 0.12, y };
    points.push({ x, y, left, right });
  }
  points.sort((left, right) => left.x - right.x);
  return points;
}

export function bezierParams(points: readonly BezierPoint[]) {
  return points.flatMap((point) => [point.x, point.y, point.left.x, point.left.y, point.right.x, point.right.y]);
}

function bezierAmount(t: number, params: readonly number[]) {
  const points = bezierPoints(params);
  const knots = [
    { x: 0, y: 0, right: points[0] ? approach(0, 0, points[0].x, points[0].y) : { x: 1 / 3, y: 0 } },
    ...points,
    {
      x: 1,
      y: 1,
      left: points.length > 0 ? approach(1, 1, points[points.length - 1]!.x, points[points.length - 1]!.y) : { x: 2 / 3, y: 1 },
    },
  ];
  let index = 0;
  while (index < knots.length - 2 && knots[index + 1]!.x < t) index += 1;
  const from = knots[index]!;
  const to = knots[index + 1] ?? from;
  const span = to.x - from.x;
  if (span === 0) return to.y;
  const u = solveBezier(Math.min(1, Math.max(0, (t - from.x) / span)), 0, (from.right.x - from.x) / span, ((to.left?.x ?? to.x) - from.x) / span, 1);
  return bezier(u, from.y, from.right.y, to.left?.y ?? to.y, to.y);
}

function approach(x: number, y: number, towardX: number, towardY: number) {
  return { x: x + (towardX - x) / 3, y: y + (towardY - y) / 3 };
}

function bezier(t: number, a: number, b: number, c: number, d: number) {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
}

function solveBezier(x: number, a: number, b: number, c: number, d: number) {
  let t = x;
  for (let step = 0; step < 8; step++) {
    const slope = bezierSlope(t, a, b, c, d);
    if (Math.abs(slope) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - (bezier(t, a, b, c, d) - x) / slope));
  }
  return t;
}

function bezierSlope(t: number, a: number, b: number, c: number, d: number) {
  const m = 1 - t;
  return 3 * m * m * (b - a) + 6 * m * t * (c - b) + 3 * t * t * (d - c);
}

function blendColor(from: string, to: string, t: number, mode: BlendMode, params: readonly number[]) {
  if (mode === "none") return from;
  const start = hexChannels(from);
  const end = hexChannels(to);
  if (!start || !end) return t < 1 ? from : to;
  const rgb = blendVector(start.slice(0, 3), end.slice(0, 3), t, mode, params);
  const alpha = mix(start[3]!, end[3]!, blendAmount(t, mode, params));
  return `#${[...rgb, alpha].map(channel).join("")}`;
}

function blendTransform(from: string, to: string, t: number, mode: BlendMode, params: readonly number[]) {
  const start = matrixValues(from);
  const end = matrixValues(to);
  if (!start || !end) return t < 1 ? from : to;
  switch (mode) {
    case "none":
      return from;
    case "linear":
      return formatMatrix(blendVector(start, end, t, "linear", params));
    case "lerp":
      return formatMatrix(blendVector(start, end, t, "lerp", params));
    case "slerp":
      return formatMatrix(slerpMatrix(start, end, blendAmount(t, mode, params), params[2] ?? 0));
    case "bezier":
      return formatMatrix(blendVector(start, end, t, "bezier", params));
  }
}

function blendVector(from: number[], to: number[], t: number, mode: BlendMode, params: readonly number[]) {
  switch (mode) {
    case "none":
      return from;
    case "linear":
      return from.map((value, index) => mix(value, to[index]!, t));
    case "lerp":
      return from.map((value, index) => mix(value, to[index]!, blendAmount(t, "lerp", params)));
    case "slerp":
      return slerp(from, to, blendAmount(t, "slerp", params));
    case "bezier":
      return from.map((value, index) => mix(value, to[index]!, blendAmount(t, "bezier", params)));
  }
}

function mix(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function slerp(from: number[], to: number[], t: number) {
  const fromLength = Math.hypot(...from) || 1;
  const toLength = Math.hypot(...to) || 1;
  const dot = Math.min(1, Math.max(-1, from.reduce((sum, value, index) => sum + value * to[index]!, 0) / (fromLength * toLength)));
  const angle = Math.acos(dot);
  const scale = angle < 1e-4 ? [1 - t, t] : [Math.sin((1 - t) * angle) / Math.sin(angle), Math.sin(t * angle) / Math.sin(angle)];
  const radius = mix(fromLength, toLength, t);
  return from.map((value, index) => ((value / fromLength) * scale[0]! + (to[index]! / toLength) * scale[1]!) * radius);
}

function slerpMatrix(from: number[], to: number[], t: number, turns: number) {
  const start = decompose(from);
  const end = decompose(to);
  let turn = end.rotation - start.rotation;
  if (turn > Math.PI) turn -= Math.PI * 2;
  if (turn < -Math.PI) turn += Math.PI * 2;
  turn += Math.round(Math.min(4, Math.max(-4, turns))) * Math.PI * 2;
  const rotation = start.rotation + turn * t;
  const scaleX = mix(start.scaleX, end.scaleX, t);
  const scaleY = mix(start.scaleY, end.scaleY, t);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return [cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, mix(start.x, end.x, t), mix(start.y, end.y, t)];
}

function decompose(value: number[]) {
  const [a, b, c, d, x, y] = value as [number, number, number, number, number, number];
  return {
    rotation: Math.atan2(b, a),
    scaleX: Math.hypot(a, b) || 1,
    scaleY: Math.hypot(c, d) || 1,
    x,
    y,
  };
}

function hexChannels(value: string) {
  const hex = value.replace("#", "");
  const body = hex.length === 6 ? `${hex}ff` : hex;
  if (body.length !== 8) return null;
  return [0, 2, 4, 6].map((index) => Number.parseInt(body.slice(index, index + 2), 16));
}

function channel(value: number) {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
}

function matrixValues(value: string) {
  const body = value.match(/^matrix\(([^)]+)\)$/)?.[1];
  if (!body) return null;
  const values = body.split(",").map((part) => Number(part.trim()));
  if (values.length !== 6 || values.some((part) => Number.isNaN(part))) return null;
  return values;
}

function formatMatrix(values: number[]) {
  return `matrix(${values.map((value) => Math.round(value * 1000) / 1000).join(", ")})`;
}
