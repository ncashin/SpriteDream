import { css, on } from "remix/component";
import type { Handle } from "remix/component";

import { blendAmount, bezierParams, bezierPoints, type BezierHandle, type BezierPoint } from "./blend.ts";

const X_MIN = 0.02;
const X_MAX = 0.98;
const Y_MIN = -0.5;
const Y_MAX = 1.5;
const CURVE = "#86efac";
const HANDLE = "#7dd3fc";

export function Bezier(handle: Handle<{ params: readonly number[]; onChange: (params: number[]) => void }>) {
  let selected = -1;

  function track(event: PointerEvent, movePoint: (points: BezierPoint[], placed: { x: number; y: number }) => void) {
    event.stopPropagation();
    event.preventDefault();
    const bounds = event.currentTarget instanceof Element ? event.currentTarget.closest("[data-bezier]") : null;
    if (!(bounds instanceof HTMLElement) || event.button !== 0) return;
    const pointerId = event.pointerId;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const points = bezierPoints(handle.props.params);
      movePoint(points, fromClient(bounds, moveEvent.clientX, moveEvent.clientY));
      handle.props.onChange(bezierParams(points));
    };
    const end = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    move(event);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function addPoint(event: PointerEvent) {
    let index = -1;
    track(event, (points, next) => {
      if (index < 0 || !points[index]) {
        const point = pointAt(next.x, next.y);
        points.push(point);
        points.sort((left, right) => left.x - right.x);
        index = points.indexOf(point);
      }
      const point = points[index];
      moveKnot(points, point, next);
      if (point) index = points.indexOf(point);
      selected = index;
    });
  }

  return () => {
    const points = bezierPoints(handle.props.params);
    return (
      <span
        data-bezier=""
        mix={[
          bezier,
          on("pointerdown", (event) => {
            if (event.target !== event.currentTarget && !(event.target instanceof SVGElement)) return;
            addPoint(event);
          }),
        ]}
      >
        <svg viewBox="0 0 100 24" preserveAspectRatio="none">
          <path d={curvePath(handle.props.params)} fill="none" stroke={CURVE} stroke-width="1.5" vector-effect="non-scaling-stroke" />
          {points.map((point, index) =>
            index === selected ? (
              <g key={index}>
                <line x1={point.left.x * 100} y1={viewY(point.left.y)} x2={point.x * 100} y2={viewY(point.y)} stroke={HANDLE} stroke-width="1" vector-effect="non-scaling-stroke" />
                <line x1={point.right.x * 100} y1={viewY(point.right.y)} x2={point.x * 100} y2={viewY(point.y)} stroke={HANDLE} stroke-width="1" vector-effect="non-scaling-stroke" />
              </g>
            ) : null,
          )}
        </svg>
        {points.map((point, index) => (
          <span key={index}>
            {index === selected ? (
              <>
                <span
                  mix={[side, on("pointerdown", (event) => track(event, (nextPoints, placed) => moveSide(nextPoints, index, "left", placed)))]}
                  style={dotStyle(point.left)}
                />
                <span
                  mix={[side, on("pointerdown", (event) => track(event, (nextPoints, placed) => moveSide(nextPoints, index, "right", placed)))]}
                  style={dotStyle(point.right)}
                />
              </>
            ) : null}
            <span
              mix={[
                dot,
                on("pointerdown", (event) => {
                  selected = index;
                  track(event, (nextPoints, placed) => {
                    const point = nextPoints[selected];
                    moveKnot(nextPoints, point, placed);
                    if (point) selected = nextPoints.indexOf(point);
                  });
                }),
              ]}
              style={dotStyle(point)}
            />
          </span>
        ))}
      </span>
    );
  };
}

function pointAt(x: number, y: number): BezierPoint {
  return {
    x,
    y,
    left: { x: x - 0.12, y },
    right: { x: x + 0.12, y },
  };
}

function moveKnot(points: BezierPoint[], point: BezierPoint | undefined, placed: { x: number; y: number }) {
  if (!point) return;
  const index = points.indexOf(point);
  const previous = points[index - 1];
  const next = points[index + 1];
  const x = Math.min(next ? next.x - 0.02 : X_MAX, Math.max(previous ? previous.x + 0.02 : X_MIN, placed.x));
  const dx = x - point.x;
  const dy = placed.y - point.y;
  point.x = x;
  point.y = placed.y;
  point.left.x += dx;
  point.left.y += dy;
  point.right.x += dx;
  point.right.y += dy;
  points.sort((left, right) => left.x - right.x);
}

function moveSide(points: BezierPoint[], index: number, side: "left" | "right", placed: { x: number; y: number }) {
  const point = points[index];
  if (!point) return;
  point[side] = { x: Math.min(1.2, Math.max(-0.2, placed.x)), y: placed.y };
}

function curvePath(params: readonly number[]) {
  const curve = Array.from({ length: 25 }, (_, step) => {
    const t = step / 24;
    const amount = blendAmount(t, "bezier", params);
    return `${step === 0 ? "M" : "L"} ${(t * 100).toFixed(2)} ${(12 - amount * 10).toFixed(2)}`;
  }).join(" ");
  return `${curve} L 100 12`;
}

function viewY(y: number) {
  return 12 - y * 10;
}

function dotStyle(point: BezierHandle | BezierPoint) {
  return { left: `${point.x * 100}%`, top: `${((12 - point.y * 10) / 24) * 100}%` };
}

function fromClient(bounds: HTMLElement, clientX: number, clientY: number) {
  const rect = bounds.getBoundingClientRect();
  const x = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
  const y = rect.height === 0 ? 0 : (clientY - rect.top) / rect.height;
  return {
    x,
    y: Math.min(Y_MAX, Math.max(Y_MIN, (12 - y * 24) / 10)),
  };
}

const bezier = css({
  position: "absolute",
  left: 0,
  width: "100%",
  height: "2.75rem",
  top: "50%",
  transform: "translateY(-50%)",
  overflow: "visible",
  pointerEvents: "auto",
  cursor: "copy",
  "& svg": {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
  },
});

const handleBox = {
  position: "absolute",
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
  background: "#fff",
  border: `1px solid ${HANDLE}`,
  transform: "translate(-50%, -50%)",
  pointerEvents: "auto",
  touchAction: "none",
  cursor: "default",
} as const;

const dot = css({
  ...handleBox,
  width: "10px",
  height: "10px",
});

const side = css({
  ...handleBox,
  width: "8px",
  height: "8px",
  borderRadius: "50%",
});
