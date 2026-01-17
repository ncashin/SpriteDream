import type { ContextExtension, RequirePlugin, ClickableEntityProvider } from "../../gameContext";
import { ecsPlugin } from "../../scene/ecsAdapter";
import { inputPlugin } from "../../input";
import { useState, useEffect } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { EntityListPanel } from "./EntityListPanel";
import { EntityModal } from "./EntityModal";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
import { registerDragHandler } from "../../dragHandler";
import type { Entity } from "../ecs";

export let ecsContext: ReturnType<typeof ecsPlugin> | null = null;

let ecsEditorRoot: Root | null = null;
let ecsEditorContainer: HTMLDivElement | null = null;

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

  // Register entity drag handler
  if (
    "input" in context &&
    "ecs" in context &&
    "canvas" in context &&
    context.input &&
    context.ecs &&
    context.canvas
  ) {
    let entityDragStartPosition: { x: number; y: number } | null = null;

    registerDragHandler(
      {
        priority: 10, // Higher priority than viewport (which defaults to 0)
        canHandle: (worldX, worldY) => {
          let clickedEntity: string | null = null;
          
          // Check sprite provider first
          if ("spriteClickProvider" in context && context.spriteClickProvider) {
            clickedEntity = (context.spriteClickProvider as ClickableEntityProvider).checkClick(worldX, worldY);
          }
          
          // Check collider provider if no sprite was found
          if (!clickedEntity && "colliderClickProvider" in context && context.colliderClickProvider) {
            clickedEntity = (context.colliderClickProvider as ClickableEntityProvider).checkClick(worldX, worldY);
          }
          
          return clickedEntity !== null;
        },
        onDragStart: (worldX, worldY) => {
          // Find clicked entity
          let clickedEntity: string | null = null;
          if ("spriteClickProvider" in context && context.spriteClickProvider) {
            clickedEntity = (context.spriteClickProvider as ClickableEntityProvider).checkClick(worldX, worldY);
          }
          if (!clickedEntity && "colliderClickProvider" in context && context.colliderClickProvider) {
            clickedEntity = (context.colliderClickProvider as ClickableEntityProvider).checkClick(worldX, worldY);
          }
          
          if (clickedEntity) {
            context.ecs.selectEntity(clickedEntity);
            const entityComponents = context.ecs.getEntity(clickedEntity);
            const position = entityComponents?.position;
            if (position && typeof position.x === "number" && typeof position.y === "number") {
              entityDragStartPosition = { x: position.x, y: position.y };
            }
          }
        },
        onDrag: (worldDeltaX, worldDeltaY) => {
          if (entityDragStartPosition) {
            const selectedEntity = context.ecs.getSelectedEntity();
            if (selectedEntity) {
              const entityComponents = context.ecs.getEntity(selectedEntity);
              const position = entityComponents?.position;
              if (position && typeof position.x === "number" && typeof position.y === "number") {
                position.x = entityDragStartPosition.x + worldDeltaX;
                position.y = entityDragStartPosition.y + worldDeltaY;
              }
            }
          }
        },
        onDragEnd: () => {
          entityDragStartPosition = null;
        },
        cursor: "grabbing",
      },
      context
    );
  }
}

export function ecsEditorPlugin<T extends RequirePlugin<[typeof ecsPlugin, typeof inputPlugin]>>(
  context: T
): ContextExtension<T, {}> {
  initializeECSEditor(context);
  return context;
}
