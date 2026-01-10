import type { ContextExtension, RequirePlugin } from "../../gameContext";
import { ecsPlugin } from "../../scene/ecsAdapter";
import { useState } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { EntityListPanel } from "./EntityListPanel";
import { EntityModal } from "./EntityModal";
import type { Entity } from "../ecs";
import {
  isEditorEnabled,
  addDrawCallback,
  removeDrawCallback,
  type CallbackId,
} from "../../gameloop";

export let ecsContext: ReturnType<typeof ecsPlugin> | null = null;

let ecsEditorRoot: Root | null = null;
let ecsEditorContainer: HTMLDivElement | null = null;
let drawCallbackId: CallbackId | null = null;

function ECSEditorPluginUI() {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  if (!ecsContext) {
    return null;
  }

  const isValidEntity = (entity: Entity | null): boolean => {
    if (!entity || !ecsContext) return false;
    const componentPools = ecsContext.ecs.ecsInstance.componentPools;
    for (const componentPool of Object.values(componentPools)) {
      if (
        componentPool &&
        typeof componentPool === "object" &&
        entity in componentPool
      ) {
        return true;
      }
    }
    return false;
  };

  const validSelectedEntity = isValidEntity(selectedEntity)
    ? selectedEntity
    : null;

  if (validSelectedEntity !== selectedEntity && selectedEntity !== null) {
    queueMicrotask(() => setSelectedEntity(null));
  }

  return (
    <div className="absolute left-0 top-0 w-72 h-full bg-transparent z-[1000] flex flex-col font-[var(--vscode-font-family,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif)]">
      <EntityListPanel
        ecsContext={ecsContext}
        onEntityClick={setSelectedEntity}
      />
      <EntityModal
        isOpen={validSelectedEntity !== null}
        entity={validSelectedEntity}
        ecsContext={ecsContext}
        onClose={() => setSelectedEntity(null)}
      />
    </div>
  );
}

export function ecsEditorPlugin<T extends RequirePlugin<[typeof ecsPlugin]>>(
  context: T
): ContextExtension<T, {}> {
  if (
    !(
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.DEV
    )
  ) {
    return context;
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

  if (drawCallbackId !== null) {
    removeDrawCallback(drawCallbackId);
    drawCallbackId = null;
  }

  drawCallbackId = addDrawCallback(() => {
    if (ecsEditorRoot) {
      ecsEditorRoot.render(React.createElement(ECSEditorPluginUI));
    }
  });

  return context;
}
