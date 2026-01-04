import type { ContextExtension, RequirePlugin } from "../gameContext";
import { ecsPlugin } from "../scene/ecsAdapter";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { EntityListPanel } from "./EntityListPanel";
import { EntityModal } from "./EntityModal";
import type { Entity } from "../ecs/ecs";

// Export ECS context so React components can access it
export let ecsContext: ReturnType<typeof ecsPlugin> | null = null;

// Plugin state for React components
let pluginState: {
  reactRoot: ReturnType<typeof createRoot> | null;
  selectedEntity: Entity | null;
  setSelectedEntity: ((entity: Entity | null) => void) | null;
} = {
  reactRoot: null,
  selectedEntity: null,
  setSelectedEntity: null,
};

// Internal React component for the plugin UI
function ECSEditorPluginUI() {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  
  // Store setter so we can update from outside if needed
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

// Export function to initialize/reinitialize plugin UI
export function initializePluginUI() {
  const editor = document.querySelector<HTMLDivElement>("#editor");
  if (!editor) {
    console.warn("Editor element not found, cannot initialize ECS editor plugin UI");
    return;
  }

  // Ensure editor has relative positioning for absolute children
  if (getComputedStyle(editor).position === "static") {
    editor.style.position = "relative";
  }

  // Check if container already exists (might have been cleared by Editor component)
  let pluginContainer = document.querySelector<HTMLDivElement>("#ecs-editor-plugin-container");
  
  if (!pluginContainer) {
    // Create a container for the plugin UI
    // Append it to the editor element
    pluginContainer = document.createElement("div");
    pluginContainer.id = "ecs-editor-plugin-container";
    editor.appendChild(pluginContainer);
  }

  // Recreate root if container was removed from DOM or root doesn't exist
  if (!pluginState.reactRoot || !pluginContainer.parentElement) {
    pluginState.reactRoot = createRoot(pluginContainer);
  }

  // Render plugin UI
  if (pluginState.reactRoot && ecsContext) {
    pluginState.reactRoot.render(<ECSEditorPluginUI />);
  }
}

export function ecsEditorPlugin<
  T extends RequirePlugin<[typeof ecsPlugin]>
>(
  context: T
): ContextExtension<T, {}> {
  // Store ECS context for React components to access
  ecsContext = context as ReturnType<typeof ecsPlugin>;
  
  // Initialize plugin UI - use requestAnimationFrame to ensure editor is ready
  // This runs after initializeEditor() has set up the editor
  requestAnimationFrame(() => {
    initializePluginUI();
  });
  
  return context;
}

