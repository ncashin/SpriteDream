import { css, on } from "remix/component";
import type { Handle, RemixNode } from "remix/component";

import type { GameObject } from "../../actions/editor/object-tree.tsx";
import {
  lookupBoundingBox,
  moveBoundingBox,
  resizeBoundingBox,
  resizeDirections,
  rotateBoundingBox,
  type Bounds,
  type Point,
  type ResizeHandle,
} from "../bounding-box.ts";
import { componentKeys } from "./draw-component.ts";
import { screenToWorld, type ViewportWithTransforms } from "./viewportTransforms.ts";

const boundsKey = componentKeys();

const WHEEL_PASSTHROUGH = "data-wheel-passthrough";

export function isWheelPassthrough(target: EventTarget | null) {
  return target instanceof Element && target.closest(`[${WHEEL_PASSTHROUGH}]`) !== null;
}

const HANDLE_SIZE = 8;
const CORNER_HANDLE_SIZE = 10;
const STROKE = 1.5;
const ROTATION_REACH = 24;
const BOUNDS_COLOR = "#7dd3fc";
const cornerHandles = ["northWest", "northEast", "southEast", "southWest"] as const satisfies readonly ResizeHandle[];
const edgeHandles = ["north", "east", "south", "west"] as const satisfies readonly ResizeHandle[];

// Material Design Icons, Apache-2.0. Files live in public/cursors.
const CURSOR_OUTLINE = `fill="#000" stroke="#fff" stroke-width="2" stroke-linejoin="round" paint-order="stroke fill"`;
const RESIZE_CURSOR = `<path ${CURSOR_OUTLINE} d="M6.45 17.45L1 12l5.45-5.45l1.41 1.41L4.83 11h14.34l-3.03-3.04l1.41-1.41L23 12l-5.45 5.45l-1.41-1.41L19.17 13H4.83l3.03 3.04z"/>`;
const ROTATE_CURSOR = `<path ${CURSOR_OUTLINE} d="M15 6V3.5L19.5 7.25L15 11V8.5A6.5 6.5 0 0 0 8.5 15H11L7.25 19.5L3.5 15H6A9 9 0 0 1 15 6Z"/>`;

const frameCss = css({
  position: "relative",
  pointerEvents: "none",
});

const bodyCss = css({
  position: "absolute",
  inset: 0,
  margin: 0,
  padding: 0,
  background: "transparent",
  cursor: "move",
  pointerEvents: "auto",
  touchAction: "none",
});

const edgeCss = css({
  position: "absolute",
  boxSizing: "content-box",
  margin: 0,
  background: BOUNDS_COLOR,
  backgroundClip: "content-box",
  pointerEvents: "auto",
  touchAction: "none",
});

const handleCss = css({
  position: "absolute",
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
  background: "#fff",
  borderStyle: "solid",
  borderColor: BOUNDS_COLOR,
  pointerEvents: "auto",
  touchAction: "none",
});

const rotationCss = css({
  position: "absolute",
  margin: 0,
  padding: 0,
  background: "transparent",
  pointerEvents: "auto",
  touchAction: "none",
});

export function drawBoundingBox(
  viewport: ViewportWithTransforms & {
    drawComponent(key: object, transform: DOMMatrix, node: RemixNode): void;
  },
  object: GameObject,
) {
  const bounds = lookupBoundingBox(object);
  if (!bounds) return;
  const frame = scaleRemoved(bounds);
  viewport.drawComponent(
    boundsKey(object),
    frame.transform,
    <BoundingBox
      bounds={bounds}
      width={frame.width}
      height={frame.height}
      zoom={screenZoom(viewport.state.matrix)}
    />,
  );
}

function scaleRemoved(bounds: Bounds) {
  const scaleX = Math.hypot(bounds.transform.a, bounds.transform.b);
  const scaleY = Math.hypot(bounds.transform.c, bounds.transform.d);
  const transform = new DOMMatrix();
  transform.a = scaleX === 0 ? 1 : bounds.transform.a / scaleX;
  transform.b = scaleX === 0 ? 0 : bounds.transform.b / scaleX;
  transform.c = scaleY === 0 ? 0 : bounds.transform.c / scaleY;
  transform.d = scaleY === 0 ? 1 : bounds.transform.d / scaleY;
  const width = bounds.width * scaleX;
  const height = bounds.height * scaleY;
  transform.e = bounds.transform.e - (transform.a * width + transform.c * height) / 2;
  transform.f = bounds.transform.f - (transform.b * width + transform.d * height) / 2;
  return { transform, width, height };
}

function screenZoom(matrix: DOMMatrix) {
  const zoom = Math.hypot(matrix.a, matrix.b);
  return zoom > 1e-6 ? zoom : 1;
}

function BoundingBox(
  handle: Handle<{
    bounds: Bounds;
    width: number;
    height: number;
    zoom: number;
  }>,
) {
  return () => {
    const { bounds, width, height, zoom } = handle.props;

    return (
      <div data-wheel-passthrough="" mix={frameCss} style={{ width, height }}>
        <MoveControl bounds={bounds} />
        {edgeHandles.map((name) => (
          <EdgeControl
            key={name}
            name={name}
            bounds={bounds}
            width={width}
            height={height}
            zoom={zoom}
          />
        ))}
        <RotationControl bounds={bounds} width={width} height={height} zoom={zoom} />
        {cornerHandles.map((name) => (
          <ResizeHandleControl
            key={name}
            name={name}
            bounds={bounds}
            width={width}
            height={height}
            zoom={zoom}
          />
        ))}
      </div>
    );
  };
}

type ResizeControlProps = {
  bounds: Bounds;
  zoom: number;
};

function MoveControl(handle: Handle<{ bounds: Bounds }>) {
  let drag: {
    pointerId: number;
    origin: Point;
    x: number;
    y: number;
    style: HTMLStyleElement;
  } | null = null;

  function stop(event?: PointerEvent) {
    if (event && drag && event.pointerId !== drag.pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    drag?.style.remove();
    drag = null;
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId || event.altKey) return;
    const point = screenToWorld(event.clientX, event.clientY);
    if (!point) return;
    moveBoundingBox(handle.props.bounds, {
      x: drag.x + point.x - drag.origin.x,
      y: drag.y + point.y - drag.origin.y,
    });
  }

  handle.signal.addEventListener("abort", () => stop());

  return () => (
    <div
      mix={[
        bodyCss,
        on<HTMLDivElement, "pointerdown">("pointerdown", (event) => {
          if (event.button !== 0 || event.altKey) return;
          event.preventDefault();
          event.stopPropagation();
          stop();
          const origin = screenToWorld(event.clientX, event.clientY);
          if (!origin) return;
          const { bounds } = handle.props;
          const style = document.createElement("style");
          style.textContent =
            "html, html * { cursor: move !important; user-select: none !important; }";
          document.head.append(style);
          drag = {
            pointerId: event.pointerId,
            origin,
            x: bounds.transform.e,
            y: bounds.transform.f,
            style,
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", stop);
          window.addEventListener("pointercancel", stop);
        }),
      ]}
    />
  );
}

function EdgeControl(
  handle: Handle<
    ResizeControlProps & { name: (typeof edgeHandles)[number]; width: number; height: number }
  >,
) {
  const drag = resizeDrag(handle);

  return () => {
    const { name, bounds, width, height, zoom } = handle.props;
    const direction = resizeDirections[name];
    const cursor = resizeCursor(bounds.transform, direction);

    return (
      <div style={{ ...edgeStyle(name, width, height, zoom), cursor }} mix={[edgeCss, drag()]} />
    );
  };
}

function ResizeHandleControl(
  handle: Handle<ResizeControlProps & { name: ResizeHandle; width: number; height: number }>,
) {
  const drag = resizeDrag(handle);

  return () => {
    const { name, bounds, width, height, zoom } = handle.props;
    const direction = resizeDirections[name];
    const origin = handleOrigin(width, height, direction);
    const cursor = resizeCursor(bounds.transform, direction);
    const size = Math.max(CORNER_HANDLE_SIZE, CORNER_HANDLE_SIZE / zoom);

    return (
      <div
        style={{
          left: origin.x,
          top: origin.y,
          width: size,
          height: size,
          borderWidth: Math.max(1, 1 / zoom),
          transform: "translate(-50%, -50%)",
          cursor,
        }}
        mix={[handleCss, drag()]}
      />
    );
  };
}

function RotationControl(
  handle: Handle<ResizeControlProps & { width: number; height: number }>,
) {
  let drag: {
    pointerId: number;
    style: HTMLStyleElement;
    corner: (typeof cornerHandles)[number];
    angle: number;
    a: number;
    b: number;
    c: number;
    d: number;
  } | null = null;

  function stop(event?: PointerEvent) {
    if (event && drag && event.pointerId !== drag.pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    drag?.style.remove();
    drag = null;
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId || event.altKey) return;
    const point = screenToWorld(event.clientX, event.clientY);
    if (!point) return;
    const { bounds } = handle.props;
    const dx = point.x - bounds.transform.e;
    const dy = point.y - bounds.transform.f;
    if (dx * dx + dy * dy < 1) return;
    rotateBoundingBox(bounds, Math.atan2(dy, dx) - drag.angle, drag);
    drag.style.textContent = cursorStyle(rotateCursor(bounds.transform, drag.corner));
  }

  handle.signal.addEventListener("abort", () => stop());

  return () => {
    const { width, height, zoom } = handle.props;

    return (
      <>
        {cornerHandles.map((name) => (
          <div
            key={name}
            style={{
              ...rotationZoneStyle(name, width, height, zoom),
              cursor: rotateCursor(handle.props.bounds.transform, name),
            }}
            mix={[
              rotationCss,
              on<HTMLDivElement, "pointerdown">("pointerdown", (event) => {
                if (event.button !== 0 || event.altKey) return;
                event.preventDefault();
                event.stopPropagation();
                stop();
                const origin = screenToWorld(event.clientX, event.clientY);
                if (!origin) return;
                const { bounds } = handle.props;
                const style = document.createElement("style");
                style.textContent = cursorStyle(rotateCursor(bounds.transform, name));
                document.head.append(style);
                drag = {
                  pointerId: event.pointerId,
                  corner: name,
                  style,
                  angle: Math.atan2(origin.y - bounds.transform.f, origin.x - bounds.transform.e),
                  a: bounds.transform.a,
                  b: bounds.transform.b,
                  c: bounds.transform.c,
                  d: bounds.transform.d,
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", stop);
                window.addEventListener("pointercancel", stop);
              }),
            ]}
          />
        ))}
      </>
    );
  };
}

function resizeDrag(handle: Handle<ResizeControlProps & { name: ResizeHandle }>) {
  let drag: { pointerId: number; style: HTMLStyleElement } | null = null;

  function stop(event?: PointerEvent) {
    if (event && drag && event.pointerId !== drag.pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    drag?.style.remove();
    drag = null;
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId || event.altKey) return;
    const point = screenToWorld(event.clientX, event.clientY);
    if (!point) return;
    const { bounds, name } = handle.props;
    resizeBoundingBox(bounds, name, point);
  }

  handle.signal.addEventListener("abort", () => stop());

  return () =>
    on<HTMLDivElement, "pointerdown">("pointerdown", (event) => {
      if (event.button !== 0 || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      stop();
      const { bounds, name } = handle.props;
      const cursor = resizeCursor(bounds.transform, resizeDirections[name]);
      const style = document.createElement("style");
      style.textContent = cursorStyle(cursor);
      document.head.append(style);
      drag = { pointerId: event.pointerId, style };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });
}

function edgeStyle(
  name: (typeof edgeHandles)[number],
  width: number,
  height: number,
  zoom: number,
) {
  const stroke = STROKE / zoom;
  const pad = Math.max(0, (HANDLE_SIZE - STROKE) / 2) / zoom;

  if (name === "north" || name === "south") {
    const top = name === "north" ? -stroke / 2 : height - stroke / 2;
    return {
      left: -stroke / 2,
      top: top - pad,
      width: width + stroke,
      height: stroke,
      paddingTop: pad,
      paddingBottom: pad,
    };
  }

  const left = name === "west" ? -stroke / 2 : width - stroke / 2;
  return {
    left: left - pad,
    top: -stroke / 2,
    width: stroke,
    height: height + stroke,
    paddingLeft: pad,
    paddingRight: pad,
  };
}

function rotationZoneStyle(
  name: (typeof cornerHandles)[number],
  width: number,
  height: number,
  zoom: number,
) {
  const size = ROTATION_REACH / zoom;
  if (name === "northWest") return { left: -size, top: -size, width: size, height: size };
  if (name === "northEast") return { left: width, top: -size, width: size, height: size };
  if (name === "southEast") return { left: width, top: height, width: size, height: size };
  return { left: -size, top: height, width: size, height: size };
}

function handleOrigin(width: number, height: number, direction: { x: number; y: number }): Point {
  return {
    x: direction.x > 0 ? width : direction.x < 0 ? 0 : width / 2,
    y: direction.y > 0 ? height : direction.y < 0 ? 0 : height / 2,
  };
}

function screenAngle(transform: DOMMatrix, direction: { x: number; y: number }) {
  const dx = transform.a * direction.x + transform.c * direction.y;
  const dy = transform.b * direction.x + transform.d * direction.y;
  return Math.atan2(dy, dx);
}

function resizeCursor(transform: DOMMatrix, direction: { x: number; y: number }) {
  return svgCursor(RESIZE_CURSOR, screenAngle(transform, direction));
}

function rotateCursor(transform: DOMMatrix, corner: (typeof cornerHandles)[number]) {
  return svgCursor(
    ROTATE_CURSOR,
    screenAngle(transform, resizeDirections[corner]) + (3 * Math.PI) / 4,
  );
}

function svgCursor(body: string, radians: number) {
  const degrees = Math.round((radians * 180) / Math.PI);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='-2 -2 28 28'><defs><filter id='shadow' x='-50%' y='-50%' width='200%' height='200%'><feDropShadow dx='0' dy='1' stdDeviation='0.6' flood-color='black' flood-opacity='0.45'/></filter></defs><g filter='url(#shadow)'><g transform='rotate(${degrees} 12 12)'>${body}</g></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 11 11, auto`;
}

function cursorStyle(cursor: string) {
  return `html, html * { cursor: ${cursor} !important; user-select: none !important; }`;
}
