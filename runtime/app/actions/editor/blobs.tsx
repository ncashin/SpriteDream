import { css } from "remix/component";

const colors = ["#f43f5e", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa", "#fb7185"];

/** Perfect circle, viewBox 0 0 64 64. */
export const circle = "M32 2a30 30 0 1 0 0.01 0";

export const leftEye = "M16 26a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0";
export const rightEye = "M35 26a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0";
export const smile = "M20 40Q32 54 44 40";
export const ink = "#1c1c1e";

export function blobColor(id: string) {
  let total = 0;
  for (const char of id) total = (total + char.charCodeAt(0)) % colors.length;
  return colors[total];
}

export function blobPath(_id: string) {
  return circle;
}

export function faceFor(id: string) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" mix={face}>
      <path d={circle} fill={blobColor(id)} />
      <path d={leftEye} fill={ink} />
      <path d={rightEye} fill={ink} />
      <path d={smile} fill="none" stroke={ink} stroke-width="7" stroke-linecap="round" />
    </svg>
  );
}

const face = css({
  display: "block",
  flex: "0 0 auto",
  height: "1.35rem",
  width: "1.35rem",
});
