import type { ContextExtension, RequirePlugin } from "../gameContext";
import { inputPlugin } from "../input";
import { addStartCallback } from "../initialization";
import { registerDragHandler } from "../dragHandler";
import { isEditorUpdateEnabled } from "../gameloop";
import { isEditorMode } from "../utils";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { EditorButton } from "../editor/EditorButton";
import {
  isEditorUIVisible,
  subscribeToVisibilityChanges,
} from "../editor/uiVisibility.ts";

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

// Store the world-space dimensions that should always be visible
let targetWorldWidth: number | null = null;
let targetWorldHeight: number | null = null;

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

/**
 * Gets the display dimensions of the canvas (CSS pixels, not device pixels)
 */
function getCanvasDisplaySize(): { width: number; height: number } {
  const canvas = document.querySelector("canvas");
  if (canvas) {
  // Use the CSS dimensions, which are the display size
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

export const zoomViewport = (
  deltaScale: number,
  screenX: number,
  screenY: number
): void => {
  const oldScale = viewport.scale;
  const newScale = Math.max(0.1, Math.min(10, oldScale + deltaScale));

  if (newScale === oldScale) return;

  const { width, height } = getCanvasDisplaySize();
  const centerX = width / 2;
  const centerY = height / 2;

  const worldX = (screenX - centerX) / oldScale + viewport.x;
  const worldY = (screenY - centerY) / oldScale + viewport.y;

  viewport.scale = newScale;
  viewport.x = worldX - (screenX - centerX) / newScale;
  viewport.y = worldY - (screenY - centerY) / newScale;

  // Update target world dimensions when manually zooming
  // This allows manual zoom to work while still maintaining auto-resize behavior
  targetWorldWidth = width / newScale;
  targetWorldHeight = height / newScale;
};

export const resetViewport = (): void => {
  viewport.scale = 1;
  viewport.x = 0;
  viewport.y = 0;

  // Initialize target world dimensions based on current canvas display size
  const { width, height } = getCanvasDisplaySize();
  targetWorldWidth = width / viewport.scale;
  targetWorldHeight = height / viewport.scale;
};

/**
 * Updates the viewport scale to maintain the same world-space area visible
 * when the window/canvas size changes.
 */
const updateViewportForResize = (): void => {
  const { width, height } = getCanvasDisplaySize();

  // Initialize target dimensions if not set yet
  if (targetWorldWidth === null || targetWorldHeight === null) {
  targetWorldWidth = width / viewport.scale;
  targetWorldHeight = height / viewport.scale;
  return;
  }

  // Calculate the scale needed to maintain the same world dimensions
  const scaleX = width / targetWorldWidth;
  const scaleY = height / targetWorldHeight;

  // Use the smaller scale to ensure everything fits (maintains aspect ratio)
  const newScale = Math.min(scaleX, scaleY);

  // Update the viewport scale
  viewport.scale = Math.max(0.1, Math.min(10, newScale));
};

function ViewportDebugUI() {
  const [viewportState, setViewportState] = React.useState(getViewport());
  const [editorUIVisible, setEditorUIVisible] = React.useState(isEditorUIVisible());
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

  React.useEffect(() => {
    const unsubscribe = subscribeToVisibilityChanges(() => {
      setEditorUIVisible(isEditorUIVisible());
    });
    return unsubscribe;
  }, []);

  if (!editorUIVisible) {
    return null;
  }

  return (
  <div className="absolute bottom-0 left-0 z-[10000] p-2 text-xs select-none leading-normal flex flex-row gap-2 items-end">
  <EditorButton
    onClick={() => {
    resetViewport();
    setViewportState(getViewport());
    }}
  >
    Reset Viewport
  </EditorButton>
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

  const resizeHandler = () => {
  requestAnimationFrame(() => {
  updateViewportForResize();
  });
  };

  window.addEventListener("resize", resizeHandler);

  let viewportDragStartX: number = 0;
  let viewportDragStartY: number = 0;

  registerDragHandler(
  {
  priority: 0,
  canHandle: () => {
    if (!isEditorUpdateEnabled()) {
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
  if (!isEditorUpdateEnabled()) {
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
  // Ramping sensitivity: larger scrolls result in more zoom change
  const delta = -e.deltaY * 0.001;
  zoomViewport(delta, x, y);
  };

  gameRoot.addEventListener("wheel", wheelHandler, {
  passive: false,
  });
  }

  if (isEditorMode()) {
  if (
  !viewportDebugContainer ||
  !viewportDebugContainer.parentElement ||
  viewportDebugContainer.parentElement !== context.rootElement
  ) {
  if (viewportDebugContainer && viewportDebugContainer.parentElement) {
    viewportDebugContainer.remove();
  }
  if (viewportDebugRoot) {
    try {
    viewportDebugRoot.unmount();
    } catch (e) {
    }
    viewportDebugRoot = null;
  }

  viewportDebugContainer = document.createElement("div");
  context.rootElement.appendChild(viewportDebugContainer);
  viewportDebugRoot = createRoot(viewportDebugContainer);
  }

  if (viewportDebugRoot) {
  viewportDebugRoot.render(React.createElement(ViewportDebugUI));
  }
  }

  return context;
}

