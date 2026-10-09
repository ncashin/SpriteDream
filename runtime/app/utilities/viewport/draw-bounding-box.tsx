import { css, on } from "remix/component";
import type { Handle, RemixNode } from "remix/component";

import {
  moveBoundingBox,
  resizeBoundingBox,
  resizeDirections,
  type Bounds,
  type Point,
  type ResizeHandle,
} from "../bounding.ts";

const WHEEL_PASSTHROUGH = "data-wheel-passthrough";

export function isWheelPassthrough(target: EventTarget | null) {
  return target instanceof Element && target.closest(`[${WHEEL_PASSTHROUGH}]`) !== null;
}

const HANDLE_SIZE = 8;
const STROKE = 1.5;
const BOUNDS_COLOR = "#7dd3fc";
const cornerHandles = ["northWest", "northEast", "southEast", "southWest"] as const satisfies readonly ResizeHandle[];
const edgeHandles = ["north", "east", "south", "west"] as const satisfies readonly ResizeHandle[];

const resizeCursors = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"] as const;

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

export function drawBoundingBox(
  paint: (transform: DOMMatrix, node: RemixNode) => void,
  bounds: Bounds,
  clientToWorld: (clientX: number, clientY: number) => Point,
) {
  const frame = scaleRemoved(bounds);
  paint(
    frame.transform,
    <BoundingBox
      bounds={bounds}
      width={frame.width}
      height={frame.height}
      clientToWorld={clientToWorld}
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
  transform.e = bounds.transform.e;
  transform.f = bounds.transform.f;
  return { transform, width: bounds.width * scaleX, height: bounds.height * scaleY };
}

function BoundingBox(
  handle: Handle<{
    bounds: Bounds;
    width: number;
    height: number;
    clientToWorld: (clientX: number, clientY: number) => Point;
  }>,
) {
  return () => {
    const { bounds, width, height, clientToWorld } = handle.props;

    return (
      <div data-wheel-passthrough="" mix={frameCss} style={{ width, height }}>
        <MoveControl bounds={bounds} clientToWorld={clientToWorld} />
        {edgeHandles.map((name) => (
          <EdgeControl
            key={name}
            name={name}
            bounds={bounds}
            width={width}
            height={height}
            clientToWorld={clientToWorld}
          />
        ))}
        {cornerHandles.map((name) => (
          <ResizeHandleControl
            key={name}
            name={name}
            bounds={bounds}
            width={width}
            height={height}
            clientToWorld={clientToWorld}
          />
        ))}
      </div>
    );
  };
}

type ResizeControlProps = {
  bounds: Bounds;
  clientToWorld: (clientX: number, clientY: number) => Point;
};

function MoveControl(
  handle: Handle<{
    bounds: Bounds;
    clientToWorld: (clientX: number, clientY: number) => Point;
  }>,
) {
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
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = handle.props.clientToWorld(event.clientX, event.clientY);
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
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          stop();
          const { bounds, clientToWorld } = handle.props;
          const style = document.createElement("style");
          style.textContent =
            "html, html * { cursor: move !important; user-select: none !important; }";
          document.head.append(style);
          drag = {
            pointerId: event.pointerId,
            origin: clientToWorld(event.clientX, event.clientY),
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
  handle: Handle<ResizeControlProps & { name: (typeof edgeHandles)[number]; width: number; height: number }>,
) {
  const drag = resizeDrag(handle);

  return () => {
    const { name, bounds, width, height } = handle.props;
    const direction = resizeDirections[name];
    const cursor = resizeCursor(bounds.transform, direction);

    return <div style={{ ...edgeStyle(name, width, height), cursor }} mix={[edgeCss, drag()]} />;
  };
}

function ResizeHandleControl(
  handle: Handle<ResizeControlProps & { name: ResizeHandle; width: number; height: number }>,
) {
  const drag = resizeDrag(handle);

  return () => {
    const { name, bounds, width, height } = handle.props;
    const direction = resizeDirections[name];
    const origin = handleOrigin(width, height, direction);
    const cursor = resizeCursor(bounds.transform, direction);

    return (
      <div
        style={{
          left: origin.x,
          top: origin.y,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          borderWidth: 1,
          transform: "translate(-50%, -50%)",
          cursor,
        }}
        mix={[handleCss, drag()]}
      />
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
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { bounds, name, clientToWorld } = handle.props;
    resizeBoundingBox(bounds, name, clientToWorld(event.clientX, event.clientY));
  }

  handle.signal.addEventListener("abort", () => stop());

  return () =>
    on<HTMLDivElement, "pointerdown">("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      stop();
      const { bounds, name } = handle.props;
      const cursor = resizeCursor(bounds.transform, resizeDirections[name]);
      const style = document.createElement("style");
      style.textContent = `html, html * { cursor: ${cursor} !important; user-select: none !important; }`;
      document.head.append(style);
      drag = { pointerId: event.pointerId, style };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });
}

function edgeStyle(name: (typeof edgeHandles)[number], width: number, height: number) {
  const pad = Math.max(0, (HANDLE_SIZE - STROKE) / 2);

  if (name === "north" || name === "south") {
    const top = name === "north" ? -STROKE / 2 : height - STROKE / 2;
    return {
      left: -STROKE / 2,
      top: top - pad,
      width: width + STROKE,
      height: STROKE,
      paddingTop: pad,
      paddingBottom: pad,
    };
  }

  const left = name === "west" ? -STROKE / 2 : width - STROKE / 2;
  return {
    left: left - pad,
    top: -STROKE / 2,
    width: STROKE,
    height: height + STROKE,
    paddingLeft: pad,
    paddingRight: pad,
  };
}

function handleOrigin(width: number, height: number, direction: { x: number; y: number }): Point {
  return {
    x: direction.x > 0 ? width : direction.x < 0 ? 0 : width / 2,
    y: direction.y > 0 ? height : direction.y < 0 ? 0 : height / 2,
  };
}

function resizeCursor(transform: DOMMatrix, direction: { x: number; y: number }) {
  const dx = transform.a * direction.x + transform.c * direction.y;
  const dy = transform.b * direction.x + transform.d * direction.y;
  const index = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return resizeCursors[(((index % 8) + 8) % 8) % 4];
}
