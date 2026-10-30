import { css } from "remix/component";

const colors = ["#f43f5e", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa", "#fb7185"];

const eyes = {
  "+": "/faces/eyes/plus.svg",
  x: "/faces/eyes/x.svg",
  "-": "/faces/eyes/dash.svg",
  o: "/faces/eyes/circle.svg",
} as const;

const eyeOrder = ["+", "x", "-", "o"] as const;

const bodies = {
  circle: "M50 4a46 46 0 1 0 0.01 0",
  heart: "M50 94L11.5 51.9A25 25 0 1 1 50 20A25 25 0 1 1 88.5 51.9Z",
  hexagon: "M50 4L89.84 27L89.84 73L50 96L10.16 73L10.16 27Z",
} as const;

const bodyOrder = ["circle", "heart", "hexagon"] as const;

export const GAZE_LOOK = 8;
const GAZE_UP = 1.5;
export const eyeSize = 1.85;
export const eyeGap = 46;
export const eyeOffset = -8;
export const cursorEyeLeft = `translate(${50 - eyeGap / 2} ${50 + eyeOffset}) scale(${eyeSize})`;
export const cursorEyeRight = `translate(${50 + eyeGap / 2} ${50 + eyeOffset}) scale(${eyeSize})`;
export const gazePivot = `translate(50 ${50 + eyeOffset})`;
export const gazePivotBack = `translate(-50 ${-(50 + eyeOffset)})`;

export function blobColor(id: string) {
  let total = 0;
  for (const char of id) total = (total + char.charCodeAt(0)) % colors.length;
  return colors[total];
}

export function cursorEye(id: string) {
  return eyes[eyeOrder[hash(id) % eyeOrder.length]];
}

export function blobBody(id: string) {
  return bodies[bodyOrder[hash(id) % bodyOrder.length]];
}

export function faceFor(id: string) {
  const eye = cursorEye(id);
  const body = blobBody(id);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" mix={face}>
      <path d={body} fill={blobColor(id)} />
      <g data-gaze="">
        <image href={eye} x="-8" y="-8" width="16" height="16" transform={cursorEyeLeft} />
        <image href={eye} x="-8" y="-8" width="16" height="16" transform={cursorEyeRight} />
      </g>
    </svg>
  );
}

export function clampGaze(x: number, y: number, reach: number) {
  const length = Math.hypot(x, y);
  if (length < 0.5) return { x: 0, y: 0 };
  const scale = Math.min(1, reach / length);
  const aimY = y * scale;
  return { x: x * scale, y: aimY < 0 ? aimY * GAZE_UP : aimY };
}

export function blinkScale(time: number, phase: number) {
  const frame = (time + phase) % 2.8;
  const duration = 0.18;
  if (frame > duration) return 1;
  return 1 - Math.sin((frame / duration) * Math.PI) * 0.92;
}

export function blinkPhase(id: string) {
  return (hash(id) % 628) / 100;
}

function hash(value: string) {
  let total = 0;
  for (const char of value) total = (total * 33 + char.charCodeAt(0)) >>> 0;
  return total;
}

const face = css({
  display: "block",
  flex: "0 0 auto",
  height: "1.35rem",
  overflow: "visible",
  width: "1.35rem",
});
