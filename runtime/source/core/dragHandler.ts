import type { RequirePlugin } from "./gameContext";
import { inputPlugin } from "./input";
import { addEditorUpdateCallback } from "./gameloop";
import { getViewport } from "./viewport/viewportPlugin";

export type DragHandlerContext = RequirePlugin<[typeof inputPlugin]>;

export type DragHandler = {
  priority?: number;
  canHandle: (worldX: number, worldY: number, context: DragHandlerContext) => boolean;
  onDragStart: (worldX: number, worldY: number, context: DragHandlerContext) => void;
  onDrag: (worldDeltaX: number, worldDeltaY: number, context: DragHandlerContext) => void;
  onDragEnd: (context: DragHandlerContext) => void;
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
const DRAG_THRESHOLD = 5;

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

export function isDragging(): boolean {
  return activeHandler !== null;
}

export function getActiveHandler(): DragHandler | null {
  return activeHandler?.handler ?? null;
}

export function resetDragHandlerInitialization(): void {
  isInitialized = false;
  dragHandlers.length = 0;
  activeHandler = null;
  dragStartWorldPos = null;
  dragStartScreenPos = null;
  previousMouseDown = false;
}

export function registerDragHandler(
  handler: DragHandler,
  context: DragHandlerContext
): () => void {
  const handlerWithContext: HandlerWithContext = { handler, context };
  dragHandlers.push(handlerWithContext);
  dragHandlers.sort((a, b) => (b.handler.priority ?? 0) - (a.handler.priority ?? 0));

  if (!isInitialized) {
    isInitialized = true;
    addEditorUpdateCallback(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvas || dragHandlers.length === 0) return;

      const currentContext = activeHandler?.context ?? dragHandlers[0]?.context;
      if (!currentContext) return;

      const mousePos = currentContext.input.getMousePosition();
      const isMouseDown = currentContext.input.isMouseButtonPressed("left");
      const isMouseJustPressed = isMouseDown && !previousMouseDown;
      const dragState = currentContext.input.getDragState();
      const viewportState = getViewport();

      previousMouseDown = isMouseDown;

      if (!activeHandler && !dragState.isDragging) {
        canvas.style.cursor = "";
      }

      if (isMouseJustPressed && !dragState.isDragging) {
        const editorRoot = document.querySelector("#editor");
        if (editorRoot) {
          const elementAtPoint = document.elementFromPoint(mousePos.x, mousePos.y);
          if (elementAtPoint) {
            if (editorRoot.contains(elementAtPoint) && elementAtPoint !== editorRoot) {
              return;
            }
          }
        }

        const rect = canvas.getBoundingClientRect();
        const worldPos = screenToWorld(
          mousePos.x,
          mousePos.y,
          viewportState.x,
          viewportState.y,
          viewportState.scale,
          rect.width,
          rect.height
        );

        for (const handlerWithContext of dragHandlers) {
          if (handlerWithContext.handler.canHandle(worldPos.x, worldPos.y, handlerWithContext.context)) {
            activeHandler = handlerWithContext;
            dragStartWorldPos = worldPos;
            dragStartScreenPos = { x: mousePos.x, y: mousePos.y };
            break;
          }
        }
      }

      if (activeHandler && isMouseDown && dragStartScreenPos) {
        const editorRoot = document.querySelector("#editor");
        if (editorRoot) {
          const elementAtPoint = document.elementFromPoint(mousePos.x, mousePos.y);
          if (elementAtPoint) {
            if (editorRoot.contains(elementAtPoint) && elementAtPoint !== editorRoot) {
              cancelDrag();
              return;
            }
          }
        }

        const dx = mousePos.x - dragStartScreenPos.x;
        const dy = mousePos.y - dragStartScreenPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > DRAG_THRESHOLD) {
          if (!dragState.isDragging) {
            activeHandler.context.input.startDrag(dragStartScreenPos.x, dragStartScreenPos.y);
            activeHandler.handler.onDragStart(
              dragStartWorldPos!.x,
              dragStartWorldPos!.y,
              activeHandler.context
            );
          }

          activeHandler.context.input.updateDrag(mousePos.x, mousePos.y);
          const currentDragState = activeHandler.context.input.getDragState();

          const worldDeltaX = currentDragState.offsetX / viewportState.scale;
          const worldDeltaY = currentDragState.offsetY / viewportState.scale;

          activeHandler.handler.onDrag(worldDeltaX, worldDeltaY, activeHandler.context);

          if (activeHandler.handler.cursor) {
            canvas.style.cursor = activeHandler.handler.cursor;
          }
        }
      }

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
