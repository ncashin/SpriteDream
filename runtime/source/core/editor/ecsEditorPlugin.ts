import type { Component, Entity } from "../ecs/ecs";
import type { ContextExtension, RequirePlugin } from "../gameContext";
import { ecsPlugin } from "../scene/ecsAdapter";

let entityListContainer: HTMLDivElement | null = null;
let entityModal: HTMLDivElement | null = null;
let selectedEntity: Entity | null = null;
let refreshInterval: ReturnType<typeof setInterval> | null = null;
let ecsContext: ReturnType<typeof ecsPlugin> | null = null;

function getAllEntities(): Entity[] {
  if (!ecsContext || !ecsContext.ecs) {
    return [];
  }

  const entitySet = new Set<Entity>();
  const componentPools = ecsContext.ecs.ecsInstance.componentPools;
  
  for (const componentPool of Object.values(componentPools)) {
    if (componentPool && typeof componentPool === "object") {
      for (const entity of Object.keys(componentPool as Record<string, unknown>)) {
        entitySet.add(entity);
      }
    }
  }
  return Array.from(entitySet);
}

function getEntityData(entity: Entity): Record<string, Component> {
  if (!ecsContext || !ecsContext.ecs) {
    return {};
  }

  return ecsContext.ecs.getEntity(entity);
}

function createEntityModal(): HTMLDivElement {
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = "50%";
  modal.style.left = "50%";
  modal.style.transform = "translate(-50%, -50%)";
  modal.style.width = "400px";
  modal.style.maxWidth = "90vw";
  modal.style.maxHeight = "80vh";
  modal.style.backgroundColor = "var(--vscode-editor-background, rgba(30, 30, 30, 0.9))";
  modal.style.backdropFilter = "blur(4px)";
  modal.style.border =
    "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))";
  modal.style.borderRadius = "4px";
  modal.style.zIndex = "20000";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.3)";
  modal.style.fontFamily =
    'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)';

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.padding = "0.25rem 0.5rem 0.25rem 1rem";
  header.style.borderBottom =
    "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))";
  header.style.backgroundColor = "transparent";
  header.style.cursor = "move";
  header.style.userSelect = "none";

  const title = document.createElement("div");
  title.style.fontSize = "0.875rem";
  title.style.fontWeight = "600";
  title.style.color = "var(--vscode-foreground, #cccccc)";

  const closeButton = document.createElement("button");
  closeButton.textContent = "✕";
  closeButton.style.background = "transparent";
  closeButton.style.border = "none";
  closeButton.style.color = "var(--vscode-foreground, #cccccc)";
  closeButton.style.cursor = "pointer";
  closeButton.style.fontSize = "1.2rem";
  closeButton.style.padding = "0.25rem 0.5rem";
  closeButton.style.borderRadius = "2px";
  closeButton.style.transition = "background-color 0.1s ease-out";

  closeButton.addEventListener("mouseenter", () => {
    closeButton.style.backgroundColor =
      "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))";
  });

  closeButton.addEventListener("mouseleave", () => {
    closeButton.style.backgroundColor = "transparent";
  });

  closeButton.addEventListener("click", () => {
    hideEntityModal();
  });

  header.appendChild(title);
  header.appendChild(closeButton);

  let isDragging = false;
  let currentX = 0;
  let currentY = 0;
  let initialX = 0;
  let initialY = 0;

  const dragStart = (e: MouseEvent) => {
    if (e.target === closeButton || closeButton.contains(e.target as Node)) {
      return;
    }
    initialX = e.clientX - currentX;
    initialY = e.clientY - currentY;
    if (e.target === header || header.contains(e.target as Node)) {
      isDragging = true;
    }
  };

  const drag = (e: MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    modal.style.transform = "none";
    modal.style.left = `${currentX}px`;
    modal.style.top = `${currentY}px`;
  };

  const dragEnd = () => {
    isDragging = false;
  };

  header.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  (modal as any)._header = header;
  (modal as any)._dragStart = dragStart;
  (modal as any)._drag = drag;
  (modal as any)._dragEnd = dragEnd;

  const content = document.createElement("div");
  content.style.flex = "1";
  content.style.overflow = "auto";
  content.style.padding = "0";
  content.style.color = "var(--vscode-foreground, #cccccc)";
  content.style.fontSize = "0.8125rem";
  content.style.fontFamily =
    'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)';
  content.style.lineHeight = "1.5";

  modal.appendChild(header);
  modal.appendChild(content);

  (modal as any)._content = content;
  (modal as any)._title = title;

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && modal.parentElement) {
      hideEntityModal();
    }
  };
  document.addEventListener("keydown", handleEscape);
  (modal as any)._escapeHandler = handleEscape;

  return modal;
}

function updateEntityData(entity: Entity, newData: Record<string, Component>) {
  if (!ecsContext || !ecsContext.ecs) {
    return;
  }

  const currentData = ecsContext.ecs.getEntity(entity);
  
  for (const componentType of Object.keys(currentData)) {
    if (!newData[componentType]) {
      const componentToRemove = currentData[componentType];
      if (componentToRemove) {
        ecsContext.ecs.removeComponent(entity, componentToRemove);
      }
    }
  }

  for (const [componentType, component] of Object.entries(newData)) {
    const componentWithType = { ...component, type: component.type || componentType } as Component;
    ecsContext.ecs.addComponent(entity, componentWithType);
  }
}

function updateEntityModalContent(entity: Entity, preserveTextareaValue = false) {
  if (!entityModal) return;

  const content = (entityModal as any)._content as HTMLDivElement;
  const title = (entityModal as any)._title as HTMLDivElement;
  if (!content || !title) return;

  title.textContent = entity;

  const entityData = getEntityData(entity);
  const entityJson = JSON.stringify(entityData, null, 2);

  let textarea = content.querySelector("textarea") as HTMLTextAreaElement | null;
  
  if (!textarea) {
    textarea = document.createElement("textarea");
    textarea.style.width = "100%";
    textarea.style.minHeight = "400px";
    textarea.style.padding = "0.75rem";
    textarea.style.backgroundColor = "transparent";
    textarea.style.color = "var(--vscode-foreground, #cccccc)";
    textarea.style.border = "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))";
    textarea.style.borderRadius = "2px";
    textarea.style.fontSize = "0.8125rem";
    textarea.style.fontFamily = 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)';
    textarea.style.lineHeight = "1.5";
    textarea.style.resize = "vertical";
    textarea.style.outline = "none";
    textarea.style.boxSizing = "border-box";
    textarea.style.whiteSpace = "pre";
    textarea.style.overflowWrap = "normal";
    textarea.style.overflowX = "auto";

    let updateTimeout: ReturnType<typeof setTimeout> | null = null;
    const currentTextarea = textarea;
    currentTextarea.addEventListener("input", () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      updateTimeout = setTimeout(() => {
        if (!currentTextarea) return;
        try {
          const parsedData = JSON.parse(currentTextarea.value) as Record<string, Component>;
          if (typeof parsedData === "object" && parsedData !== null && !Array.isArray(parsedData)) {
            let isValid = true;
            for (const [componentType, component] of Object.entries(parsedData)) {
              if (typeof component !== "object" || component === null || Array.isArray(component)) {
                isValid = false;
                break;
              }
              if (!component.type) {
                (component as Component).type = componentType;
              }
            }
            if (isValid) {
              updateEntityData(entity, parsedData);
              currentTextarea.style.borderColor = "var(--vscode-panel-border, rgba(128, 128, 128, 0.2))";
            } else {
              currentTextarea.style.borderColor = "var(--vscode-inputValidation-errorBorder, #f48771)";
            }
          } else {
            currentTextarea.style.borderColor = "var(--vscode-inputValidation-errorBorder, #f48771)";
          }
        } catch (error) {
          currentTextarea.style.borderColor = "var(--vscode-inputValidation-errorBorder, #f48771)";
        }
      }, 500);
    });

    content.innerHTML = "";
    content.appendChild(textarea);
  }

  if (!preserveTextareaValue && textarea) {
    textarea.value = entityJson;
  }
}

function showEntityModal(entity: Entity) {
  selectedEntity = entity;

  if (!entityModal) {
    entityModal = createEntityModal();
    document.body.appendChild(entityModal);
  }

  updateEntityModalContent(entity);

  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  refreshInterval = setInterval(() => {
    if (selectedEntity && entityModal) {
      const content = (entityModal as any)._content as HTMLDivElement;
      const textarea = content?.querySelector("textarea") as HTMLTextAreaElement | null;
      const isFocused = document.activeElement === textarea;
      if (!isFocused) {
        updateEntityModalContent(selectedEntity, false);
      }
    }
  }, 500);
}

function hideEntityModal() {
  if (entityModal) {
    const escapeHandler = (entityModal as any)._escapeHandler;
    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
    }

    const header = (entityModal as any)._header;
    const dragStart = (entityModal as any)._dragStart;
    const drag = (entityModal as any)._drag;
    const dragEnd = (entityModal as any)._dragEnd;
    if (header && dragStart) {
      header.removeEventListener("mousedown", dragStart);
    }
    if (drag) {
      document.removeEventListener("mousemove", drag);
    }
    if (dragEnd) {
      document.removeEventListener("mouseup", dragEnd);
    }

    entityModal.remove();
    entityModal = null;
    selectedEntity = null;
  }

  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

function createEntityListItem(entity: Entity): HTMLDivElement {
  const item = document.createElement("div");
  item.style.padding = "0.25rem 0.75rem";
  item.style.width = "100%";
  item.style.boxSizing = "border-box";
  item.style.cursor = "pointer";
  item.style.borderRadius = "2px";
  item.style.marginBottom = "0.25rem";
  item.style.transition = "background-color 0.1s ease-out";
  item.style.color = "var(--vscode-foreground, #cccccc)";
  item.style.fontSize = "0.8125rem";
  item.style.fontFamily =
    'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)';

  const entityId = document.createElement("span");
  entityId.textContent = entity;
  entityId.style.overflow = "hidden";
  entityId.style.textOverflow = "ellipsis";
  entityId.style.whiteSpace = "nowrap";

  item.appendChild(entityId);

  item.addEventListener("mouseenter", () => {
    item.style.backgroundColor =
      "var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))";
  });

  item.addEventListener("mouseleave", () => {
    item.style.backgroundColor = "transparent";
  });

  item.addEventListener("click", () => {
    showEntityModal(entity);
  });

  return item;
}

function updateEntityList() {
  if (!entityListContainer) return;

  const entities = getAllEntities();
  entityListContainer.innerHTML = "";

  if (entities.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.textContent = "No entities found";
    emptyMessage.style.padding = "0.75rem";
    emptyMessage.style.color =
      "var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))";
    emptyMessage.style.fontSize = "0.8125rem";
    emptyMessage.style.textAlign = "center";
    entityListContainer.appendChild(emptyMessage);
    return;
  }

  for (const entity of entities) {
    const item = createEntityListItem(entity);
    entityListContainer.appendChild(item);
  }
}

export function ecsEditorPlugin<
  T extends RequirePlugin<[typeof ecsPlugin]>
>(
  context: T
): ContextExtension<T, {}> {
  ecsContext = context as ReturnType<typeof ecsPlugin>;
  
  const editor = document.querySelector<HTMLDivElement>("#editor");
  if (!editor) {
    console.error("Could not find #editor element");
    return context;
  }

  const entityListPanel = document.createElement("div");
  entityListPanel.style.position = "absolute";
  entityListPanel.style.left = "0";
  entityListPanel.style.top = "0";
  entityListPanel.style.width = "300px";
  entityListPanel.style.height = "100%";
  entityListPanel.style.backgroundColor = "transparent";
  entityListPanel.style.zIndex = "1000";
  entityListPanel.style.display = "flex";
  entityListPanel.style.flexDirection = "column";
  entityListPanel.style.fontFamily =
    'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)';

  const dropdownHeader = document.createElement("button");
  dropdownHeader.style.padding = "0.25rem 0.75rem";
  dropdownHeader.style.fontSize = "0.8125rem";
  dropdownHeader.style.fontWeight = "400";
  dropdownHeader.style.borderRadius = "2px";
  dropdownHeader.style.border = "none";
  dropdownHeader.style.cursor = "pointer";
  dropdownHeader.style.transition = "background-color 0.1s ease-out";
  dropdownHeader.style.backgroundColor = "transparent";
  dropdownHeader.style.color =
    "var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))";
  dropdownHeader.style.fontFamily =
    'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)';
  dropdownHeader.style.outline = "none";
  dropdownHeader.style.boxSizing = "border-box";
  dropdownHeader.style.display = "inline-flex";
  dropdownHeader.style.alignItems = "center";
  dropdownHeader.style.justifyContent = "space-between";
  dropdownHeader.style.minHeight = "22px";
  dropdownHeader.style.lineHeight = "1.4em";
  dropdownHeader.style.width = "100%";
  dropdownHeader.style.userSelect = "none";

  const dropdownTitle = document.createElement("span");
  dropdownTitle.textContent = "Show Entity List";
  dropdownTitle.style.fontSize = "0.8125rem";
  dropdownTitle.style.fontWeight = "400";

  const dropdownIcon = document.createElement("span");
  dropdownIcon.textContent = "▼";
  dropdownIcon.style.fontSize = "0.75rem";
  dropdownIcon.style.transition = "transform 0.2s ease-out";

  dropdownHeader.appendChild(dropdownTitle);
  dropdownHeader.appendChild(dropdownIcon);

  entityListContainer = document.createElement("div");
  entityListContainer.style.flex = "1";
  entityListContainer.style.overflow = "auto";
  entityListContainer.style.padding = "0";
  entityListContainer.style.backgroundColor = "transparent";
  entityListContainer.style.borderBottom =
    "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))";

  let isExpanded = true;
  dropdownHeader.style.borderBottom =
    "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))";

  dropdownHeader.addEventListener("mouseenter", () => {
    dropdownHeader.style.backgroundColor =
      "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))";
  });

  dropdownHeader.addEventListener("mouseleave", () => {
    dropdownHeader.style.backgroundColor = "transparent";
  });

  dropdownHeader.addEventListener("mousedown", () => {
    dropdownHeader.style.backgroundColor =
      "var(--vscode-button-activeBackground, rgba(255, 255, 255, 0.15))";
  });

  dropdownHeader.addEventListener("mouseup", () => {
    dropdownHeader.style.backgroundColor =
      "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))";
  });

  dropdownHeader.addEventListener("focus", () => {
    dropdownHeader.style.outline =
      "1px solid var(--vscode-focusBorder, #007acc)";
    dropdownHeader.style.outlineOffset = "-1px";
  });

  dropdownHeader.addEventListener("blur", () => {
    dropdownHeader.style.outline = "none";
  });

  dropdownHeader.addEventListener("click", () => {
    isExpanded = !isExpanded;
    if (entityListContainer) {
      if (isExpanded) {
        entityListContainer.style.display = "block";
        dropdownIcon.style.transform = "rotate(0deg)";
        dropdownHeader.style.borderBottom =
          "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))";
      } else {
        entityListContainer.style.display = "none";
        dropdownIcon.style.transform = "rotate(-90deg)";
        dropdownHeader.style.borderBottom = "none";
      }
    }
  });

  entityListPanel.appendChild(dropdownHeader);
  entityListPanel.appendChild(entityListContainer);

  if (getComputedStyle(editor).position === "static") {
    editor.style.position = "relative";
  }

  editor.appendChild(entityListPanel);

  updateEntityList();

  setInterval(() => {
    updateEntityList();
  }, 1000);

  return context;
}

