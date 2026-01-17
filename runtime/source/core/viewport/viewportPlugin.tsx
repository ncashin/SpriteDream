import type { ContextExtension, RequirePlugin } from "../gameContext";
import { inputPlugin } from "../input";
import { addStartCallback } from "../initialization";
import { registerDragHandler } from "../dragHandler";
import React from "react";
import { createRoot, type Root } from "react-dom/client";

export type Viewport = {
  x: number;
  y: number;
  scale: number;
};

let viewport: Viewport = {
  x: 0,
  y: 0,
  scale: 1,
};

export const getViewport = (): Viewport => ({ ...viewport });

export const setViewport = (x: number, y: number): void => {
  viewport.x = x;
  viewport.y = y;
};

export const setViewportScale = (scale: number): void => {
  viewport.scale = Math.max(0.1, Math.min(10, scale));
};

export const updateViewport = (deltaX: number, deltaY: number): void => {
  viewport.x += deltaX;
  viewport.y += deltaY;
};

export const zoomViewport = (
  deltaScale: number,
  screenX: number,
  screenY: number
): void => {
  const oldScale = viewport.scale;
  const newScale = Math.max(0.1, Math.min(10, oldScale + deltaScale));

  if (newScale === oldScale) return;

  const canvas = document.querySelector("canvas");
  if (!canvas) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const worldX = (screenX - centerX) / oldScale + viewport.x;
  const worldY = (screenY - centerY) / oldScale + viewport.y;

  viewport.scale = newScale;
  viewport.x = worldX - (screenX - centerX) / newScale;
  viewport.y = worldY - (screenY - centerY) / newScale;
};

export const resetViewport = (): void => {
  viewport.scale = 1;
  viewport.x = 0;
  viewport.y = 0;
};

function ViewportDebugUI() {
  const [viewportState, setViewportState] = React.useState(getViewport());
  const animationFrameRef = React.useRef<number>();

  React.useEffect(() => {
    const updateViewport = () => {
      setViewportState(getViewport());
      animationFrameRef.current = requestAnimationFrame(updateViewport);
    };
    animationFrameRef.current = requestAnimationFrame(updateViewport);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        zIndex: 10000,
        padding: "0.5rem",
        fontSize: "0.75rem",
        color: "rgba(255, 255, 255, 0.6)",
        fontFamily: "system-ui, sans-serif",
        userSelect: "none",
        lineHeight: 1.5,
      }}
    >
      <div
        onClick={() => {
          resetViewport();
          setViewportState(getViewport());
        }}
        style={{
          cursor: "pointer",
          marginBottom: "0.25rem",
        }}
      >
        Reset Viewport
      </div>
      <div>
        {viewportState.x.toFixed(1)}, {viewportState.y.toFixed(1)}, {(viewportState.scale * 100).toFixed(0)}%
      </div>
    </div>
  );
}

let viewportDebugRoot: Root | null = null;
let viewportDebugContainer: HTMLDivElement | null = null;

export function viewportPlugin<T extends RequirePlugin<[typeof inputPlugin]>>(
  context: T
): ContextExtension<T, {}> {
  addStartCallback(() => {
    resetViewport();
  });

  // Register viewport pan handler (lower priority than entity drag)
  let viewportDragStartX: number = 0;
  let viewportDragStartY: number = 0;

  registerDragHandler(
    {
      priority: 0, // Lower priority - only handles if no entity was clicked
      canHandle: () => {
        // Always return true - this is the fallback handler for empty space
        // Higher priority handlers (like entity drag) will claim the drag first
        return true;
      },
      onDragStart: () => {
        const viewportState = getViewport();
        viewportDragStartX = viewportState.x;
        viewportDragStartY = viewportState.y;
      },
      onDrag: (worldDeltaX, worldDeltaY) => {
        const newViewportX = viewportDragStartX - worldDeltaX;
        const newViewportY = viewportDragStartY - worldDeltaY;
        setViewport(newViewportX, newViewportY);
      },
      onDragEnd: () => {
        // No cleanup needed
      },
      cursor: "grabbing",
    },
    context
  );

  // Set up wheel handler for zooming
  let wheelHandler: ((e: WheelEvent) => void) | null = null;
  if (!wheelHandler) {
    wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = document.querySelector("canvas");
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -0.03 : 0.03;
      zoomViewport(delta, x, y);
    };
    window.addEventListener("wheel", wheelHandler, {
      passive: false,
    });
  }

  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.DEV
  ) {
    if (
      !viewportDebugContainer ||
      viewportDebugContainer.parentElement !== context.editorRootElement
    ) {
      if (viewportDebugContainer) {
        viewportDebugContainer.remove();
      }
      viewportDebugContainer = document.createElement("div");
      context.editorRootElement.appendChild(viewportDebugContainer);
      viewportDebugRoot = createRoot(viewportDebugContainer);
    }

    if (viewportDebugRoot) {
      viewportDebugRoot.render(React.createElement(ViewportDebugUI));
    }
  }

  return context;
}

