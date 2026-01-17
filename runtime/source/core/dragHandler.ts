import type { RequirePlugin } from "./gameContext";
import { inputPlugin } from "./input";
import { addEditorCallback } from "./gameloop";
import { getViewport } from "./viewport/viewportPlugin";

export type DragHandlerContext = RequirePlugin<[typeof inputPlugin]>;

export type DragHandler = {
  /** Priority - higher priority handlers are checked first (default: 0) */
  priority?: number;
  /** Check if this handler should claim the drag at the given world coordinates */
  canHandle: (worldX: number, worldY: number, context: DragHandlerContext) => boolean;
  /** Called when drag starts */
  onDragStart: (worldX: number, worldY: number, context: DragHandlerContext) => void;
  /** Called every frame while dragging */
  onDrag: (worldDeltaX: number, worldDeltaY: number, context: DragHandlerContext) => void;
  /** Called when drag ends */
  onDragEnd: (context: DragHandlerContext) => void;
  /** Optional: cursor to set while dragging */
  cursor?: string;
};

type HandlerWithContext = {
  handler: DragHandler;
  context: DragHandlerContext;
};

const dragHandlers: HandlerWithContext[] = [];
let activeHandler: HandlerWithContext | null = null;
let dragStartWorldPos: { x: number; y: number } | null = null;
let dragStartScreenPos: { x: number; y: number } | null = null;
let previousMouseDown = false;
let isInitialized = false;
const DRAG_THRESHOLD = 5; // pixels

/**
 * Convert screen coordinates to world coordinates
 */
function screenToWorld(
  screenX: number,
  screenY: number,
  viewportX: number,
  viewportY: number,
  viewportScale: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const worldX = (screenX - centerX) / viewportScale + viewportX;
  const worldY = (screenY - centerY) / viewportScale + viewportY;
  return { x: worldX, y: worldY };
}

/**
 * Cancel the current active drag
 */
export function cancelDrag(): void {
  if (activeHandler) {
    activeHandler.handler.onDragEnd(activeHandler.context);
    activeHandler.context.input.endDrag();
    activeHandler = null;
    dragStartWorldPos = null;
    dragStartScreenPos = null;
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (canvas) {
      canvas.style.cursor = "";
    }
  }
}

/**
 * Check if a drag is currently active
 */
export function isDragging(): boolean {
  return activeHandler !== null;
}

/**
 * Get the currently active handler
 */
export function getActiveHandler(): DragHandler | null {
  return activeHandler?.handler ?? null;
}

/**
 * Register a drag handler. Higher priority handlers are checked first.
 */
export function registerDragHandler(
  handler: DragHandler,
  context: DragHandlerContext
): () => void {
  const handlerWithContext: HandlerWithContext = { handler, context };
  dragHandlers.push(handlerWithContext);
  // Sort by priority (higher first)
  dragHandlers.sort((a, b) => (b.handler.priority ?? 0) - (a.handler.priority ?? 0));
  
  // Auto-initialize if not already done
  if (!isInitialized) {
    isInitialized = true;
    addEditorCallback(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvas || dragHandlers.length === 0) return;

      // Use active handler's context if dragging, otherwise use first available
      const currentContext = activeHandler?.context ?? dragHandlers[0]?.context;
      if (!currentContext) return;

      const mousePos = currentContext.input.getMousePosition();
      const isMouseDown = currentContext.input.isMouseButtonPressed("left");
      const isMouseJustPressed = isMouseDown && !previousMouseDown;
      const dragState = currentContext.input.getDragState();
      const viewportState = getViewport();

      previousMouseDown = isMouseDown;

      // Reset cursor if not dragging
      if (!activeHandler && !dragState.isDragging) {
        canvas.style.cursor = "";
      }

      // Handle mouse press - find handler
      if (isMouseJustPressed && !dragState.isDragging) {
        // Check if click is on an editor UI element - if so, don't start drag
        const editorRoot = document.querySelector("#editor");
        if (editorRoot) {
          const elementAtPoint = document.elementFromPoint(mousePos.x, mousePos.y);
          if (elementAtPoint) {
            // Check if the element is within the editor root and is interactive
            // (editor root has pointer-events: none, but its children have pointer-events: auto)
            if (editorRoot.contains(elementAtPoint) && elementAtPoint !== editorRoot) {
              // Click is on editor UI, don't start drag
              return;
            }
          }
        }

        const worldPos = screenToWorld(
          mousePos.x,
          mousePos.y,
          viewportState.x,
          viewportState.y,
          viewportState.scale,
          canvas.width,
          canvas.height
        );

        // Find the first handler that can handle this drag
        for (const handlerWithContext of dragHandlers) {
          if (handlerWithContext.handler.canHandle(worldPos.x, worldPos.y, handlerWithContext.context)) {
            activeHandler = handlerWithContext;
            dragStartWorldPos = worldPos;
            dragStartScreenPos = { x: mousePos.x, y: mousePos.y };
            break;
          }
        }
      }

      // Handle dragging
      if (activeHandler && isMouseDown && dragStartScreenPos) {
        const dx = mousePos.x - dragStartScreenPos.x;
        const dy = mousePos.y - dragStartScreenPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > DRAG_THRESHOLD) {
          // Start drag if not already started
          if (!dragState.isDragging) {
            activeHandler.context.input.startDrag(dragStartScreenPos.x, dragStartScreenPos.y);
            activeHandler.handler.onDragStart(
              dragStartWorldPos!.x,
              dragStartWorldPos!.y,
              activeHandler.context
            );
          }

          // Update drag
          activeHandler.context.input.updateDrag(mousePos.x, mousePos.y);
          const currentDragState = activeHandler.context.input.getDragState();

          const worldDeltaX = currentDragState.offsetX / viewportState.scale;
          const worldDeltaY = currentDragState.offsetY / viewportState.scale;

          activeHandler.handler.onDrag(worldDeltaX, worldDeltaY, activeHandler.context);

          // Update cursor
          if (activeHandler.handler.cursor) {
            canvas.style.cursor = activeHandler.handler.cursor;
          }
        }
      }

      // Handle drag end
      if (!isMouseDown && activeHandler) {
        if (dragState.isDragging) {
          activeHandler.handler.onDragEnd(activeHandler.context);
        }
        currentContext.input.endDrag();
        activeHandler = null;
        dragStartWorldPos = null;
        dragStartScreenPos = null;
        canvas.style.cursor = "";
      }
    });
  }
  
  // Return unregister function
  return () => {
    const index = dragHandlers.indexOf(handlerWithContext);
    if (index !== -1) {
      dragHandlers.splice(index, 1);
    }
    if (activeHandler === handlerWithContext) {
      cancelDrag();
    }
  };
}
