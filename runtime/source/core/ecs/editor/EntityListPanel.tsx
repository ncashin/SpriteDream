import { useState, useEffect, useRef } from "react";
import type { Entity, Component } from "../ecs";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";

interface EntityListPanelProps {
  ecsContext: {
    ecs: {
      ecsInstance: {
        componentPools: Record<string, Record<string, unknown>>;
      };
      getEntity: (entity: Entity) => Record<string, Component>;
      createEntity: (name?: string) => Entity;
      destroyEntity: (entity: Entity) => void;
      addComponent: <ComponentType extends Component>(
        entity: Entity,
        component: ComponentType
      ) => void;
    };
  } | null;
  onEntityClick: (entity: Entity) => void;
}

function getAllEntities(
  ecsContext: EntityListPanelProps["ecsContext"]
): Entity[] {
  if (!ecsContext || !ecsContext.ecs) {
    return [];
  }

  const entitySet = new Set<Entity>();
  const componentPools = ecsContext.ecs.ecsInstance.componentPools;

  for (const componentPool of Object.values(componentPools)) {
    if (componentPool && typeof componentPool === "object") {
      for (const entity of Object.keys(
        componentPool as Record<string, unknown>
      )) {
        entitySet.add(entity);
      }
    }
  }
  return Array.from(entitySet);
}

// Preserve expanded state across HMR
let preservedIsExpanded = true;

export function EntityListPanel({
  ecsContext,
  onEntityClick,
}: EntityListPanelProps) {
  // Restore preserved state on mount
  const [isExpanded, setIsExpanded] = useState(preservedIsExpanded);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredEntity, setHoveredEntity] = useState<Entity | null>(null);
  const [renamingEntity, setRenamingEntity] = useState<Entity | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const callbackIdRef = useRef<number | null>(null);

  // Update preserved state when it changes
  useEffect(() => {
    preservedIsExpanded = isExpanded;
  }, [isExpanded]);

  // Update entities every frame via game loop, but only when they actually change
  useEffect(() => {
    const updateEntities = () => {
      const allEntities = getAllEntities(ecsContext);
      // Only update state if entities actually changed to prevent unnecessary re-renders
      setEntities((prevEntities) => {
        if (
          prevEntities.length !== allEntities.length ||
          !prevEntities.every((entity, index) => entity === allEntities[index])
        ) {
          return allEntities;
        }
        return prevEntities;
      });
    };

    // Initial update
    updateEntities();

    // Also do an immediate update after a short delay to catch entities that might
    // be added right after initialization
    const timeoutId = setTimeout(() => {
      updateEntities();
    }, 100);

    // Register draw callback to update every frame (runs regardless of editorEnabled state)
    const callbackId = addDrawCallback(() => {
      updateEntities();
    });
    callbackIdRef.current = callbackId;

    return () => {
      clearTimeout(timeoutId);
      if (callbackIdRef.current !== null) {
        removeDrawCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
    };
  }, [ecsContext]);

  const handleCreateEntity = () => {
    if (!ecsContext) return;

    // Find a unique name starting with "newEntity"
    const allEntities = getAllEntities(ecsContext);
    let entityName = "newEntity";
    let counter = 0;

    while (allEntities.includes(entityName)) {
      counter++;
      entityName = `newEntity${counter}`;
    }

    const newEntity = ecsContext.ecs.createEntity(entityName);
    // Add a default position component so the entity appears in the list
    ecsContext.ecs.addComponent(newEntity, {
      type: "position",
      x: 0,
      y: 0,
    });
    onEntityClick(newEntity);
  };

  const handleDeleteEntity = (entity: Entity, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ecsContext) return;
    ecsContext.ecs.destroyEntity(entity);
    setHoveredEntity(null);
  };

  const handleStartRename = (entity: Entity, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingEntity(entity);
    setRenameValue(entity);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ecsContext || !renamingEntity) return;

    const newName = renameValue.trim();
    if (newName && newName !== renamingEntity) {
      // Check if the new name already exists
      const allEntities = getAllEntities(ecsContext);
      if (allEntities.includes(newName)) {
        // Name already exists, cancel rename
        setRenamingEntity(null);
        setRenameValue("");
        return;
      }

      // Get all components from the old entity
      const oldEntityData = ecsContext.ecs.getEntity(renamingEntity);

      // Create new entity with the new name
      const newEntity = ecsContext.ecs.createEntity(newName);

      // Copy all components to the new entity
      for (const component of Object.values(oldEntityData)) {
        ecsContext.ecs.addComponent(newEntity, component);
      }

      // Delete the old entity
      ecsContext.ecs.destroyEntity(renamingEntity);

      // Select the new entity
      onEntityClick(newEntity);
    }

    setRenamingEntity(null);
    setRenameValue("");
  };

  const handleRenameCancel = () => {
    setRenamingEntity(null);
    setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      handleRenameCancel();
    } else if (e.key === "Enter") {
      handleRenameSubmit(e);
    }
  };

  // Focus rename input when renaming starts
  useEffect(() => {
    if (renamingEntity && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingEntity]);

  return (
    <div
      style={{
        backgroundColor: "rgba(128, 128, 128, 0.3)",
        borderRadius: "2px",
        border: "none",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        width: "250px",
      }}
    >
      <button
        style={{
          padding: "0.25rem 0.25rem 0.25rem 0.5rem",
          fontSize: "0.75rem",
          fontWeight: "normal",
          border: "none",
          borderBottom: isExpanded
            ? "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))"
            : "none",
          cursor: "pointer",
          backgroundColor: isHovered
            ? "rgba(128, 128, 128, 0.35)"
            : "transparent",
          color: "var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))",
          fontFamily:
            "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
          outline: "none",
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "20px",
          lineHeight: "1.4em",
          width: "100%",
          userSelect: "none",
          transition: "background-color 0.1s ease-out",
          borderRadius: isExpanded ? "2px 2px 0 0" : "2px",
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={(e) => {
          e.currentTarget.style.outline =
            "1px solid var(--vscode-focusBorder, #007acc)";
          e.currentTarget.style.outlineOffset = "-1px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = "none";
        }}
      >
        <span style={{ fontSize: "0.75rem", fontWeight: "normal" }}>
          Entities ({entities.length})
        </span>
        <span
          className={`codicon ${
            isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"
          }`}
          style={{
            fontSize: "0.75rem",
            marginLeft: "0.25rem",
          }}
        />
      </button>
      {isExpanded && (
        <>
          {/* New Entity Button - Fixed at top */}
          <button
            style={{
              padding: "0.25rem 0.5rem",
              minHeight: "20px",
              lineHeight: "1.4em",
              width: "100%",
              boxSizing: "border-box",
              cursor: "pointer",
              color: "var(--vscode-foreground, #cccccc)",
              fontSize: "0.75rem",
              fontFamily:
                "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
              backgroundColor: "rgba(0, 0, 0, 0.1)",
              border: "none",
              borderBottom:
                "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))",
              transition: "background-color 0.1s ease-out",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
            onClick={handleCreateEntity}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
            }}
          >
            <span
              className="codicon codicon-add"
              style={{ fontSize: "0.75rem" }}
            />
            <span>New Entity</span>
          </button>

          {/* Scrollable Entity List */}
          <div
            style={{
              overflow: "auto",
              padding: 0,
              paddingBottom: "0.25rem",
              backgroundColor: "rgba(0, 0, 0, 0.1)",
              height: "120px", // Exactly 6 entities (6 * 20px)
              borderRadius: "0 0 2px 2px",
            }}
          >
            {entities.length === 0 ? (
              <div
                style={{
                  padding: "0.25rem 0.5rem",
                  minHeight: "20px",
                  lineHeight: "1.4em",
                  color:
                    "var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))",
                  fontSize: "0.75rem",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                No entities
              </div>
            ) : (
              entities.map((entity) => (
                <div
                  key={entity}
                  style={{
                    padding: "0.25rem 0.5rem",
                    minHeight: "20px",
                    lineHeight: "1.4em",
                    width: "100%",
                    boxSizing: "border-box",
                    cursor: "pointer",
                    color: "var(--vscode-foreground, #cccccc)",
                    fontSize: "0.75rem",
                    fontFamily:
                      "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
                    backgroundColor:
                      hoveredEntity === entity
                        ? "var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))"
                        : "transparent",
                    transition: "background-color 0.1s ease-out",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                  onClick={() => onEntityClick(entity)}
                  onMouseEnter={() => setHoveredEntity(entity)}
                  onMouseLeave={() => setHoveredEntity(null)}
                >
                  {renamingEntity === entity ? (
                    <form
                      onSubmit={handleRenameSubmit}
                      style={{ flex: 1, display: "flex", minWidth: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={handleRenameSubmit}
                        style={{
                          flex: 1,
                          padding: 0,
                          margin: 0,
                          fontSize: "0.75rem",
                          backgroundColor: "transparent",
                          color: "var(--vscode-foreground, #cccccc)",
                          border: "none",
                          outline: "none",
                          boxShadow: "none",
                          fontFamily:
                            "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                          width: "100%",
                          lineHeight: "1.4em",
                        }}
                      />
                    </form>
                  ) : (
                    <>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {entity}
                      </span>
                      {hoveredEntity === entity && (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.125rem",
                            alignItems: "center",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.125rem 0.0625rem 0.125rem 0.125rem",
                              width: "16px",
                              height: "16px",
                              borderRadius: "2px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color:
                                "var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))",
                              transition: "background-color 0.1s ease-out",
                            }}
                            onClick={(e) => handleStartRename(entity, e)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                            }}
                            title="Rename entity"
                          >
                            <span
                              className="codicon codicon-edit"
                              style={{ fontSize: "0.75rem" }}
                            />
                          </button>
                          <button
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.125rem 0.0625rem 0.125rem 0.125rem",
                              width: "16px",
                              height: "16px",
                              borderRadius: "2px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--vscode-errorForeground, #f48771)",
                              transition: "background-color 0.1s ease-out",
                            }}
                            onClick={(e) => handleDeleteEntity(entity, e)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                            }}
                            title="Delete entity"
                          >
                            <span
                              className="codicon codicon-trash"
                              style={{ fontSize: "0.75rem" }}
                            />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
