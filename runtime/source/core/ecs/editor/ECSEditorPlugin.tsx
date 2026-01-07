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

  if (pluginState.reactRoot && ecsContext) {
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
  
  ecsContext = context;
  editorRootElement = context.editorRootElement;
  
  requestAnimationFrame(() => {
    initializePluginUI();
  });
  
  return context;
}















