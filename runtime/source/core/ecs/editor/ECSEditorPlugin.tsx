import type { ContextExtension, RequirePlugin } from "../../gameContext";
import { ecsPlugin } from "../../scene/ecsAdapter";
import { useState, useEffect } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { EntityListPanel } from "./EntityListPanel";
import { EntityModal } from "./EntityModal";
import type { Entity } from "../ecs";

export let ecsContext: ReturnType<typeof ecsPlugin> | null = null;

let ecsEditorRoot: Root | null = null;
let ecsEditorContainer: HTMLDivElement | null = null;

// Preserve state across HMR
let preservedSelectedEntity: Entity | null = null;

function ECSEditorPluginUI() {
  // Restore preserved state on mount
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(
    preservedSelectedEntity
  );

  // Update preserved state when it changes
  useEffect(() => {
    preservedSelectedEntity = selectedEntity;
  }, [selectedEntity]);

  if (!ecsContext) {
    return null;
  }

  const isValidEntity = (entity: Entity | null): boolean => {
    if (!entity || !ecsContext) return false;
    const entities = ecsContext.ecs.ecsInstance.entities;
    return entity in entities;
  };

  const validSelectedEntity = isValidEntity(selectedEntity)
    ? selectedEntity
    : null;

  if (validSelectedEntity !== selectedEntity && selectedEntity !== null) {
    queueMicrotask(() => setSelectedEntity(null));
  }

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

  // Re-render when context changes (e.g., on HMR)
  // React will update the component (not remount) if the component type is the same,
  // preserving internal state. Our module-level state preservation ensures state
  // is restored even if React does remount.
  if (ecsEditorRoot) {
    ecsEditorRoot.render(React.createElement(ECSEditorPluginUI));
  }

  return context;
}
