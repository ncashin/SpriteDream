import { css } from "remix/component";

const colors = ["#f43f5e", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa", "#fb7185"];

const symbols = {
  "+": "M-1.6 -7h3.2V-1.6H7v3.2H1.6V7h-3.2V1.6H-7v-3.2h5.4z",
  "0": "M0-7A7 7 0 1 0 0 7A7 7 0 1 0 0-7M0-3.8A3.8 3.8 0 1 1 0 3.8A3.8 3.8 0 1 1 0-3.8M-1.6-3.8h3.2V-1.6H3.8v3.2H1.6V3.8h-3.2V1.6H-3.8v-3.2h2.2z",
  x: "M-5.2-7.2-7.2-5.2-2 0-7.2 5.2-5.2 7.2 0 2 5.2 7.2 7.2 5.2 2 0 7.2-5.2 5.2-7.2 0-2z",
  "-": "M-7-1.7h14v3.4h-14z",
} as const;

const symbolOrder = ["+", "0", "x", "-"] as const;

const bodies = {
  circle: "M50 4a46 46 0 1 0 0.01 0",
  heart: "M50 94L11.5 51.9A25 25 0 1 1 50 20A25 25 0 1 1 88.5 51.9Z",
  hexagon: "M50 4L89.84 27L89.84 73L50 96L10.16 73L10.16 27Z",
} as const;

const bodyOrder = ["circle", "heart", "hexagon"] as const;

export const ink = "#000";
export const GAZE_LOOK = 8;
const GAZE_UP = 1.5;
export const eyeSize = 2;
export const eyeGap = 48;
export const eyeOffset = 0;
export const cursorEyeLeft = `translate(${50 - eyeGap / 2} ${50 + eyeOffset}) scale(${eyeSize})`;
export const cursorEyeRight = `translate(${50 + eyeGap / 2} ${50 + eyeOffset}) scale(${eyeSize})`;

export function blobColor(id: string) {
  let total = 0;
  for (const char of id) total = (total + char.charCodeAt(0)) % colors.length;
  return colors[total];
}

export function cursorSymbol(id: string) {
  return symbols[symbolOrder[hash(id) % symbolOrder.length]];
}

export function blobBody(id: string) {
  return bodies[bodyOrder[hash(id) % bodyOrder.length]];
}

export function faceFor(id: string) {
  const eyes = cursorSymbol(id);
  const body = blobBody(id);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" mix={face}>
      <path d={body} fill={blobColor(id)} />
      <g data-gaze="">
        <path d={eyes} fill={ink} fill-rule="evenodd" transform={cursorEyeLeft} />
        <path d={eyes} fill={ink} fill-rule="evenodd" transform={cursorEyeRight} />
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
  width: "1.35rem",
});
