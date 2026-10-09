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
  zoom: number,
) {
  paint(
    bounds.transform,
    <BoundingBox bounds={bounds} clientToWorld={clientToWorld} zoom={zoom} />,
  );
}

function BoundingBox(
  handle: Handle<{
    bounds: Bounds;
    clientToWorld: (clientX: number, clientY: number) => Point;
    zoom: number;
  }>,
) {
  return () => {
    const { bounds, clientToWorld, zoom } = handle.props;

    return (
      <div mix={frameCss} style={{ width: bounds.width, height: bounds.height }}>
        <MoveControl bounds={bounds} clientToWorld={clientToWorld} />
        {edgeHandles.map((name) => (
          <EdgeControl
            key={name}
            name={name}
            bounds={bounds}
            clientToWorld={clientToWorld}
            zoom={zoom}
          />
        ))}
        {cornerHandles.map((name) => (
          <ResizeHandleControl
            key={name}
            name={name}
            bounds={bounds}
            clientToWorld={clientToWorld}
            zoom={zoom}
          />
        ))}
      </div>
    );
  };
}

type ResizeControlProps = {
  bounds: Bounds;
  clientToWorld: (clientX: number, clientY: number) => Point;
  zoom: number;
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

function EdgeControl(handle: Handle<ResizeControlProps & { name: (typeof edgeHandles)[number] }>) {
  const drag = resizeDrag(handle);

  return () => {
    const { name, bounds, zoom } = handle.props;
    const direction = resizeDirections[name];
    const cursor = resizeCursor(bounds.transform, direction);

    return (
      <div
        style={{ ...edgeStyle(name, bounds, axisScale(bounds.transform, zoom)), cursor }}
        mix={[edgeCss, drag()]}
      />
    );
  };
}

function ResizeHandleControl(handle: Handle<ResizeControlProps & { name: ResizeHandle }>) {
  const drag = resizeDrag(handle);

  return () => {
    const { name, bounds, zoom } = handle.props;
    const direction = resizeDirections[name];
    const scale = axisScale(bounds.transform, zoom);
    const width = HANDLE_SIZE / scale.x;
    const height = HANDLE_SIZE / scale.y;
    const origin = handleOrigin(bounds, direction);
    const cursor = resizeCursor(bounds.transform, direction);
    const borderX = 1 / scale.x;
    const borderY = 1 / scale.y;

    return (
      <div
        style={{
          left: origin.x,
          top: origin.y,
          width,
          height,
          borderTopWidth: borderY,
          borderRightWidth: borderX,
          borderBottomWidth: borderY,
          borderLeftWidth: borderX,
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

function edgeStyle(
  name: (typeof edgeHandles)[number],
  bounds: Bounds,
  scale: { x: number; y: number },
) {
  const strokeX = STROKE / scale.x;
  const strokeY = STROKE / scale.y;
  const padX = Math.max(0, (HANDLE_SIZE / scale.x - strokeX) / 2);
  const padY = Math.max(0, (HANDLE_SIZE / scale.y - strokeY) / 2);

  if (name === "north" || name === "south") {
    const top = name === "north" ? -strokeY / 2 : bounds.height - strokeY / 2;
    return {
      left: -strokeX / 2,
      top: top - padY,
      width: bounds.width + strokeX,
      height: strokeY,
      paddingTop: padY,
      paddingBottom: padY,
    };
  }

  const left = name === "west" ? -strokeX / 2 : bounds.width - strokeX / 2;
  return {
    left: left - padX,
    top: -strokeY / 2,
    width: strokeX,
    height: bounds.height + strokeY,
    paddingLeft: padX,
    paddingRight: padX,
  };
}

function axisScale(transform: DOMMatrix, zoom: number) {
  return {
    x: Math.max(Math.hypot(transform.a, transform.b) * zoom, 1e-6),
    y: Math.max(Math.hypot(transform.c, transform.d) * zoom, 1e-6),
  };
}

function handleOrigin(bounds: Bounds, direction: { x: number; y: number }): Point {
  return {
    x: direction.x > 0 ? bounds.width : direction.x < 0 ? 0 : bounds.width / 2,
    y: direction.y > 0 ? bounds.height : direction.y < 0 ? 0 : bounds.height / 2,
  };
}

function resizeCursor(transform: DOMMatrix, direction: { x: number; y: number }) {
  const dx = transform.a * direction.x + transform.c * direction.y;
  const dy = transform.b * direction.x + transform.d * direction.y;
  const index = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return resizeCursors[(((index % 8) + 8) % 8) % 4];
}
