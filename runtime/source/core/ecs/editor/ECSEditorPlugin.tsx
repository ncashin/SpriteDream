import type { ContextExtension, RequirePlugin } from "../../gameContext";
import { ecsPlugin } from "../../scene/ecsAdapter";
import { inputPlugin } from "../../input";
import { addDrawCallback, isEditorUpdateEnabled } from "../../gameloop";
import { registerDragHandler } from "../../dragHandler";
import { getViewport } from "../../viewport/viewportPlugin";
import type { ClickableEntityProvider } from "../ecs";
import { setEditorECSContext } from "../../editor/editorInitializer";

function getClickProviders(context: any): ClickableEntityProvider[] {
  const providers: ClickableEntityProvider[] = [];
  for (const key in context) {
    const value = context[key];
    if (value && typeof value === "object" && typeof value.checkClick === "function") {
      providers.push(value as ClickableEntityProvider);
    }
  }
  return providers;
}

function checkClickProviders(context: any, worldX: number, worldY: number): string | null {
  for (const provider of getClickProviders(context)) {
    const entity = provider.checkClick(worldX, worldY);
    if (entity) return entity;
  }
  return null;
}

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
  return {
    x: (screenX - centerX) / viewportScale + viewportX,
    y: (screenY - centerY) / viewportScale + viewportY,
  };
}

function initializeECSEditor<T extends RequirePlugin<[typeof ecsPlugin, typeof inputPlugin]>>(
  context: T
): void {
  if (!(typeof import.meta !== "undefined" && import.meta.env?.DEV)) {
    return;
  }

  // Register the ECS context with the editor
  setEditorECSContext(context);

  if (!("input" in context && "ecs" in context && "canvas" in context)) {
    return;
  }

  let entityDragStartPosition: { x: number; y: number } | null = null;
  let draggedEntity: string | null = null;
  let hasDragged = false;

  // Entity drag handler
  registerDragHandler(
    {
      priority: 10,
      canHandle: (worldX, worldY) => {
        if (!isEditorUpdateEnabled()) return false;
        return checkClickProviders(context, worldX, worldY) !== null;
      },
      onDragStart: (worldX, worldY) => {
        hasDragged = true;
        const clickedEntity = checkClickProviders(context, worldX, worldY);
        if (clickedEntity) {
          draggedEntity = clickedEntity;
          const entityComponents = context.ecs.getEntity(clickedEntity);
          const position = entityComponents?.position;
          if (position && typeof position.x === "number" && typeof position.y === "number") {
            entityDragStartPosition = { x: position.x, y: position.y };
          }
        }
      },
      onDrag: (worldDeltaX, worldDeltaY) => {
        if (entityDragStartPosition && draggedEntity) {
          const entityComponents = context.ecs.getEntity(draggedEntity);
          const position = entityComponents?.position;
          if (position && typeof position.x === "number" && typeof position.y === "number") {
            position.x = entityDragStartPosition.x + worldDeltaX;
            position.y = entityDragStartPosition.y + worldDeltaY;
          }
        }
      },
      onDragEnd: () => {
        entityDragStartPosition = null;
        draggedEntity = null;
        hasDragged = false;
      },
      cursor: "grabbing",
    },
    context
  );

  // Click and hover handling
  const canvas = context.canvas as HTMLCanvasElement;
  let previousMouseDown = false;

  addDrawCallback(() => {
    if (!isEditorUpdateEnabled() || !canvas) return;

    const mousePos = context.input.getMousePosition();
    const isMouseDown = context.input.isMouseButtonPressed("left");
    const isMouseJustReleased = !isMouseDown && previousMouseDown;
    const dragState = context.input.getDragState();
    const viewportState = getViewport();

    previousMouseDown = isMouseDown;

    // Hover cursor
    if (!dragState.isDragging && !isMouseDown) {
      const worldPos = screenToWorld(
        mousePos.x, mousePos.y,
        viewportState.x, viewportState.y, viewportState.scale,
        canvas.width, canvas.height
      );
      canvas.style.cursor = checkClickProviders(context, worldPos.x, worldPos.y) ? "pointer" : "";
    }

    // Reset drag state on mouse down
    if (isMouseDown && !previousMouseDown && !dragState.isDragging) {
      hasDragged = false;
    }

    // Click handling (mouse up without drag)
    if (isMouseJustReleased && !hasDragged && !dragState.isDragging) {
      const editorRoot = document.querySelector("#editor");
      let shouldHandleClick = true;

      if (editorRoot) {
        const elementAtPoint = document.elementFromPoint(mousePos.x, mousePos.y);
        if (elementAtPoint && editorRoot.contains(elementAtPoint) && elementAtPoint !== editorRoot) {
          shouldHandleClick = false;
        }
      }

      if (shouldHandleClick) {
        const worldPos = screenToWorld(
          mousePos.x, mousePos.y,
          viewportState.x, viewportState.y, viewportState.scale,
          canvas.width, canvas.height
        );
        const clickedEntity = checkClickProviders(context, worldPos.x, worldPos.y);

        if (clickedEntity) {
          context.ecs.selectEntity(clickedEntity);
        } else {
          context.ecs.clearSelection();
        }
      }

      hasDragged = false;
    }
  });
}

export function ecsEditorPlugin<T extends RequirePlugin<[typeof ecsPlugin, typeof inputPlugin]>>(
  context: T
): ContextExtension<T, {}> {
  initializeECSEditor(context);
  return context;
}
