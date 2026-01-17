import type { ContextExtension, RequirePlugin } from "../gameContext";
import { inputPlugin } from "../input";
import { addStartCallback } from "../initialization";
import { registerDragHandler } from "../dragHandler";
import { isEditorEnabled } from "../gameloop";
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

  let viewportDragStartX: number = 0;
  let viewportDragStartY: number = 0;

  registerDragHandler(
    {
      priority: 0,
      canHandle: () => {
        if (!isEditorEnabled()) {
          return false;
        }
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
      },
      cursor: "grabbing",
    },
    context
  );

  const gameRoot = document.querySelector("#gameRoot") as HTMLElement | null;
  if (gameRoot) {
    const wheelHandler = (e: WheelEvent) => {
      if (!isEditorEnabled()) {
        return;
      }

      const editorRoot = document.querySelector("#editor");
      if (editorRoot) {
        const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
        if (elementAtPoint && editorRoot.contains(elementAtPoint) && elementAtPoint !== editorRoot) {
          return;
        }
      }
      
      const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvas) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -0.03 : 0.03;
      zoomViewport(delta, x, y);
    };
    
    gameRoot.addEventListener("wheel", wheelHandler, {
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

