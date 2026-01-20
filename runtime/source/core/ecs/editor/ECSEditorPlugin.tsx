import type { ContextExtension, RequirePlugin } from "../../gameContext";
import { ecsPlugin } from "../../scene/ecsAdapter";
import { inputPlugin } from "../../input";
import { useState, useEffect } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { EntityListPanel } from "./EntityListPanel";
import { EntityModal } from "./EntityModal";
import { addDrawCallback, removeDrawCallback, isEditorUpdateEnabled } from "../../gameloop";
import { registerDragHandler } from "../../dragHandler";
import { getViewport } from "../../viewport/viewportPlugin";
import type { Entity, ClickableEntityProvider } from "../ecs";

/**
 * Finds all ClickableEntityProvider instances on the context object.
 * This allows plugins to add click providers with arbitrary property names.
 */
function getClickProviders(context: any): ClickableEntityProvider[] {
  const providers: ClickableEntityProvider[] = [];
  for (const key in context) {
    const value = context[key];
    if (
      value &&
      typeof value === "object" &&
      typeof value.checkClick === "function"
    ) {
      providers.push(value as ClickableEntityProvider);
    }
  }
  return providers;
}

/**
 * Checks all click providers on the context for a click at the given world position.
 * Returns the first entity found, or null if none.
 */
function checkClickProviders(
  context: any,
  worldX: number,
  worldY: number
): string | null {
  const providers = getClickProviders(context);
  for (const provider of providers) {
    const entity = provider.checkClick(worldX, worldY);
    if (entity) {
      return entity;
    }
  }
  return null;
}

export let ecsContext: ReturnType<typeof ecsPlugin> | null = null;

let ecsEditorRoot: Root | null = null;
let ecsEditorContainer: HTMLDivElement | null = null;

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

function ECSEditorPluginUI() {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  if (!ecsContext) {
    return null;
  }

  useEffect(() => {
    const updateSelection = () => {
      const currentSelection = ecsContext?.ecs.getSelectedEntity() ?? null;
      setSelectedEntity(currentSelection);
    };

    updateSelection();

    const callbackId = addDrawCallback(() => {
      updateSelection();
    });

    return () => {
      if (callbackId !== null) {
        removeDrawCallback(callbackId);
      }
    };
  }, [ecsContext]);

  const isValidEntity = (entity: Entity | null): boolean => {
    if (!entity || !ecsContext) return false;
    const entities = ecsContext.ecs.ecsInstance.entities;
    return entity in entities;
  };

  const validSelectedEntity = isValidEntity(selectedEntity)
    ? selectedEntity
    : null;

  return (
    <div
      style={{
        position: "absolute",
        top: "0.5rem",
        left: "0.5rem",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        alignItems: "flex-start",
      }}
    >
      <EntityListPanel ecsContext={ecsContext} />
      <EntityModal
        isOpen={validSelectedEntity !== null}
        entity={validSelectedEntity}
        ecsContext={ecsContext}
        onClose={() => ecsContext?.ecs.clearSelection()}
      />
    </div>
  );
}

export function initializeECSEditor<T extends RequirePlugin<[typeof ecsPlugin, typeof inputPlugin]>>(
  context: T
): void {
  if (
    !(
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.DEV
    )
  ) {
    return;
  }

  ecsContext = context;

  if (
    !ecsEditorContainer ||
    ecsEditorContainer.parentElement !== context.editorRootElement
  ) {
    if (ecsEditorContainer) {
      ecsEditorContainer.remove();
    }
    ecsEditorContainer = document.createElement("div");
    context.editorRootElement.appendChild(ecsEditorContainer);
    ecsEditorRoot = createRoot(ecsEditorContainer);
  }

  if (ecsEditorRoot) {
    ecsEditorRoot.render(React.createElement(ECSEditorPluginUI));
  }

  if (
    "input" in context &&
    "ecs" in context &&
    "canvas" in context &&
    context.input &&
    context.ecs &&
    context.canvas
  ) {
    let entityDragStartPosition: { x: number; y: number } | null = null;
    let draggedEntity: string | null = null;
    let hasDragged = false;

    registerDragHandler(
      {
        priority: 10,
        canHandle: (worldX, worldY) => {
          if (!isEditorUpdateEnabled()) {
            return false;
          }
          
          const clickedEntity = checkClickProviders(context, worldX, worldY);
          return clickedEntity !== null;
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

    // Track mouse down to detect clicks vs drags
    let previousMouseDown = false;
    const canvas = context.canvas as HTMLCanvasElement;
    addDrawCallback(() => {
      if (!isEditorUpdateEnabled() || !canvas) return;

      const mousePos = context.input.getMousePosition();
      const isMouseDown = context.input.isMouseButtonPressed("left");
      const isMouseJustPressed = isMouseDown && !previousMouseDown;
      const isMouseJustReleased = !isMouseDown && previousMouseDown;
      const dragState = context.input.getDragState();
      const viewportState = getViewport();

      previousMouseDown = isMouseDown;

        // Check for hover to show pointer cursor
      if (!dragState.isDragging && !isMouseDown) {
        const worldPos = screenToWorld(
          mousePos.x,
          mousePos.y,
          viewportState.x,
          viewportState.y,
          viewportState.scale,
          canvas.width,
          canvas.height
        );

        const hoveredEntity = checkClickProviders(context, worldPos.x, worldPos.y);

        if (hoveredEntity) {
          canvas.style.cursor = "pointer";
        } else {
          canvas.style.cursor = "";
        }
      }

      // Track mouse down to reset drag state
      if (isMouseJustPressed && !dragState.isDragging) {
        hasDragged = false;
      }

      // Handle click (mouse release without drag)
      if (isMouseJustReleased && !hasDragged && !dragState.isDragging) {
        const editorRoot = document.querySelector("#editor");
        let shouldHandleClick = true;
        if (editorRoot) {
          const elementAtPoint = document.elementFromPoint(mousePos.x, mousePos.y);
          if (elementAtPoint) {
            if (editorRoot.contains(elementAtPoint) && elementAtPoint !== editorRoot) {
              shouldHandleClick = false;
            }
          }
        }

        if (shouldHandleClick) {
          const worldPos = screenToWorld(
            mousePos.x,
            mousePos.y,
            viewportState.x,
            viewportState.y,
            viewportState.scale,
            canvas.width,
            canvas.height
          );

          const clickedEntity = checkClickProviders(context, worldPos.x, worldPos.y);

          if (clickedEntity) {
            context.ecs.selectEntity(clickedEntity);
          } else {
            // Clicked on empty space, deselect
            context.ecs.clearSelection();
          }
        }

        hasDragged = false;
      }
    });
  }
}

export function ecsEditorPlugin<T extends RequirePlugin<[typeof ecsPlugin, typeof inputPlugin]>>(
  context: T
): ContextExtension<T, {}> {
  initializeECSEditor(context);
  return context;
}
