import type { ContextExtension, RequirePlugin } from "../../gameContext";
import { ecsPlugin } from "../../scene/ecsAdapter";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { EntityListPanel } from "./EntityListPanel";
import { EntityModal } from "./EntityModal";
import type { Entity } from "../ecs";
import { isEditorEnabled } from "../../gameloop";

export let ecsContext: ReturnType<typeof ecsPlugin> | null = null;
let editorRootElement: HTMLElement | null = null;

let pluginState: {
  reactRoot: ReturnType<typeof createRoot> | null;
  selectedEntity: Entity | null;
  setSelectedEntity: ((entity: Entity | null) => void) | null;
} = {
  reactRoot: null,
  selectedEntity: null,
  setSelectedEntity: null,
};

function ECSEditorPluginUI() {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  
  pluginState.selectedEntity = selectedEntity;
  pluginState.setSelectedEntity = setSelectedEntity;

  return (
    <div className="absolute left-0 top-0 w-72 h-full bg-transparent z-[1000] flex flex-col font-[var(--vscode-font-family,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif)]">
      <EntityListPanel
        ecsContext={ecsContext}
        onEntityClick={setSelectedEntity}
      />
      <EntityModal
        isOpen={selectedEntity !== null}
        entity={selectedEntity}
        ecsContext={ecsContext}
        onClose={() => setSelectedEntity(null)}
      />
    </div>
  );
}

export function initializePluginUI() {
  if (!editorRootElement) {
    console.warn("Editor root element not found, cannot initialize ECS editor plugin UI");
    return;
  }

  if (getComputedStyle(editorRootElement).position === "static") {
    editorRootElement.style.position = "relative";
  }

  let pluginContainer = document.querySelector<HTMLDivElement>("#ecs-editor-plugin-container");
  
  if (!pluginContainer) {
    pluginContainer = document.createElement("div");
    pluginContainer.id = "ecs-editor-plugin-container";
    editorRootElement.appendChild(pluginContainer);
  }

  if (!pluginState.reactRoot || !pluginContainer.parentElement) {
    pluginState.reactRoot = createRoot(pluginContainer);
  }

  // Always render, even if ecsContext is null (component handles null gracefully)
  // This ensures the component is rendered and will update when ecsContext becomes available
  if (pluginState.reactRoot) {
    pluginState.reactRoot.render(<ECSEditorPluginUI />);
  }
}

function forceRerender() {
  if (pluginState.reactRoot) {
    pluginState.reactRoot.render(<ECSEditorPluginUI />);
  }
}

export function ecsEditorPlugin<
  T extends RequirePlugin<[typeof ecsPlugin]>
>(
  context: T
): ContextExtension<T, {}> {
  if (
    !isEditorEnabled() ||
    !(typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV)
  ) {
    return context;
  }
  
  // Set ecsContext synchronously before any async operations
  ecsContext = context;
  editorRootElement = context.editorRootElement;
  
  // Initialize UI - this will render the component with the updated ecsContext
  // Use requestAnimationFrame to ensure DOM is ready, but ecsContext is already set above
  requestAnimationFrame(() => {
    initializePluginUI();
  });
  
  // Also force a re-render in the next event loop tick to handle any race conditions
  // where the component might have rendered before ecsContext was set
  // This ensures the component always sees the latest ecsContext value
  Promise.resolve().then(() => {
    forceRerender();
  });
  
  return context;
}















