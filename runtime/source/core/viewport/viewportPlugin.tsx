import type { ContextExtension, InitialGameContext } from "../gameContext";
import { addEditorCallback } from "../gameloop";
import { addStartCallback } from "../initialization";
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

export function viewportPlugin<T extends InitialGameContext>(
  context: T
): ContextExtension<T, {}> {
  addStartCallback(() => {
    resetViewport();
  });

  let isDraggingViewport: boolean = false;
  let viewportDragStartX: number = 0;
  let viewportDragStartY: number = 0;
  let wheelHandler: ((e: WheelEvent) => void) | null = null;

  addEditorCallback(() => {
    if (
      !("input" in context) ||
      !("ecs" in context) ||
      !("canvas" in context) ||
      !context.input ||
      !context.ecs ||
      !context.canvas
    ) {
      return;
    }

    const mousePos = (context.input as any).getMousePosition();
    const isMouseDown = (context.input as any).isMouseButtonPressed("left");
    const viewportState = getViewport();
    const dragState = (context.input as any).getDragState();

    if (!wheelHandler && context.canvas) {
      wheelHandler = (e: WheelEvent) => {
        e.preventDefault();
        const rect = (context.canvas as HTMLCanvasElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -0.03 : 0.03;
        zoomViewport(delta, x, y);
      };
      (context.canvas as HTMLCanvasElement).addEventListener("wheel", wheelHandler, {
        passive: false,
      });
    }

    if (isMouseDown && !dragState.isDragging) {
      const selectedEntity = (context.ecs as any).getSelectedEntity?.();
      const centerX = (context.canvas as HTMLCanvasElement).width / 2;
      const centerY = (context.canvas as HTMLCanvasElement).height / 2;
      const worldMouseX = (mousePos.x - centerX) / viewportState.scale + viewportState.x;
      const worldMouseY = (mousePos.y - centerY) / viewportState.scale + viewportState.y;
      
      let clickingOnEntity = false;
      if (typeof (context.ecs as any).runQuery === "function") {
        try {
          // Check for sprites
          const positionType = { type: "position" };
          const spriteType = { type: "sprite" };
          
          (context.ecs as any).runQuery(
            [positionType, spriteType],
            (_entity: any, components: any) => {
              if (clickingOnEntity) return;
              const [position, sprite] = components;
              if (position && sprite && typeof position.x === "number" && typeof sprite.width === "number") {
                const left = position.x - sprite.width / 2;
                const right = position.x + sprite.width / 2;
                const top = position.y - sprite.height / 2;
                const bottom = position.y + sprite.height / 2;
                if (
                  worldMouseX >= left &&
                  worldMouseX <= right &&
                  worldMouseY >= top &&
                  worldMouseY <= bottom
                ) {
                  clickingOnEntity = true;
                }
              }
            }
          );

          // Also check for colliders (if no sprite was found)
          if (!clickingOnEntity) {
            const colliderType = { type: "collider" };
            (context.ecs as any).runQuery(
              [positionType, colliderType],
              (_entity: any, components: any) => {
                if (clickingOnEntity) return;
                const [position, collider] = components;
                if (position && collider && collider.collisionEnabled) {
                  // Simple bounding box check for colliders
                  const width = collider.width ?? 32;
                  const height = collider.height ?? 32;
                  const offsetX = collider.offsetX ?? 0;
                  const offsetY = collider.offsetY ?? 0;
                  const left = position.x + offsetX - width / 2;
                  const right = position.x + offsetX + width / 2;
                  const top = position.y + offsetY - height / 2;
                  const bottom = position.y + offsetY + height / 2;
                  if (
                    worldMouseX >= left &&
                    worldMouseX <= right &&
                    worldMouseY >= top &&
                    worldMouseY <= bottom
                  ) {
                    clickingOnEntity = true;
                  }
                }
              }
            );
          }
        } catch {
          clickingOnEntity = false;
        }
      }
      
      if (!clickingOnEntity && !selectedEntity) {
        isDraggingViewport = true;
        viewportDragStartX = viewportState.x;
        viewportDragStartY = viewportState.y;
        (context.input as any).startDrag(mousePos.x, mousePos.y);
      }
    }

    if (isDraggingViewport && dragState.isDragging) {
      (context.input as any).updateDrag(mousePos.x, mousePos.y);
      const dragState = (context.input as any).getDragState();
      (context.canvas as HTMLCanvasElement).style.cursor = "grabbing";
      
      if (
        viewportState.x === 0 &&
        viewportState.y === 0 &&
        viewportState.scale === 1 &&
        (viewportDragStartX !== 0 || viewportDragStartY !== 0)
      ) {
        (context.input as any).endDrag();
        isDraggingViewport = false;
      } else {
        const worldDeltaX = dragState.offsetX / viewportState.scale;
        const worldDeltaY = dragState.offsetY / viewportState.scale;
        const newViewportX = viewportDragStartX - worldDeltaX;
        const newViewportY = viewportDragStartY - worldDeltaY;
        setViewport(newViewportX, newViewportY);
      }
    }

    if (!isMouseDown && isDraggingViewport) {
      (context.input as any).endDrag();
      isDraggingViewport = false;
    }
  });

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

