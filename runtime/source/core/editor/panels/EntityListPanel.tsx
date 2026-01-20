import { useState, useEffect, useRef } from "react";
import type { Entity } from "../../ecs/ecs";
import { useGameContext } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";

export function EntityListPanel() {
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs as any;
  const [isExpanded, setIsExpanded] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredEntity, setHoveredEntity] = useState<Entity | null>(null);
  const [renamingEntity, setRenamingEntity] = useState<Entity | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Sync entities from ECS
  useEffect(() => {
    if (!ecs) return;

    const updateEntities = () => {
      const allEntities = Object.keys(ecs.ecsInstance.entities);
      setEntities((prev) => {
        if (
          prev.length !== allEntities.length ||
          !prev.every((e, i) => e === allEntities[i])
        ) {
          return allEntities;
        }
        return prev;
      });
    };

    updateEntities();
    const callbackId = addDrawCallback(updateEntities);

    return () => {
      removeDrawCallback(callbackId);
    };
  }, [ecs]);

  // Sync selected entity
  useEffect(() => {
    if (!ecs) return;

    const updateSelection = () => {
      setSelectedEntity(ecs.getSelectedEntity() ?? null);
    };

    updateSelection();
    const callbackId = addDrawCallback(updateSelection);

    return () => {
      removeDrawCallback(callbackId);
    };
  }, [ecs]);

  // Focus rename input
  useEffect(() => {
    if (renamingEntity && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingEntity]);

  if (!ecs) return null;

  const handleCreateEntity = () => {
    const allEntities = Object.keys(ecs.ecsInstance.entities);
    let entityName = "newEntity";
    let counter = 0;

    while (allEntities.includes(entityName)) {
      counter++;
      entityName = `newEntity${counter}`;
    }

    const newEntity = ecs.createEntity(entityName);
    ecs.addComponent(newEntity, { type: "position", x: 0, y: 0 });
    ecs.selectEntity(newEntity);
  };

  const handleDeleteEntity = (entity: Entity, e: React.MouseEvent) => {
    e.stopPropagation();
    ecs.destroyEntity(entity);
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
    if (!renamingEntity) return;

    const newName = renameValue.trim();
    if (newName && newName !== renamingEntity) {
      const allEntities = Object.keys(ecs.ecsInstance.entities);
      if (!allEntities.includes(newName)) {
        const oldEntityData = ecs.getEntity(renamingEntity);
        const newEntity = ecs.createEntity(newName);

        for (const component of Object.values(oldEntityData)) {
          ecs.addComponent(newEntity, component);
        }

        ecs.destroyEntity(renamingEntity);
        ecs.selectEntity(newEntity);
      }
    }

    setRenamingEntity(null);
    setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setRenamingEntity(null);
      setRenameValue("");
    } else if (e.key === "Enter") {
      handleRenameSubmit(e);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "rgba(128, 128, 128, 0.3)",
        borderRadius: "2px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--vscode-font-family, system-ui, -apple-system, sans-serif)",
        width: "250px",
      }}
    >
      {/* Header */}
      <button
        style={{
          padding: "0.25rem 0.25rem 0.25rem 0.5rem",
          fontSize: "0.75rem",
          border: "none",
          borderBottom: isExpanded ? "1px solid rgba(128, 128, 128, 0.2)" : "none",
          cursor: "pointer",
          backgroundColor: isHovered ? "rgba(128, 128, 128, 0.35)" : "transparent",
          color: "rgba(255, 255, 255, 0.9)",
          outline: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "20px",
          width: "100%",
          userSelect: "none",
          transition: "background-color 0.1s",
          borderRadius: isExpanded ? "2px 2px 0 0" : "2px",
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span>Entities ({entities.length})</span>
        <span
          className={`codicon ${isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"}`}
          style={{ fontSize: "0.75rem", marginLeft: "0.25rem" }}
        />
      </button>

      {isExpanded && (
        <>
          {/* New Entity Button */}
          <button
            style={{
              padding: "0.25rem 0.5rem",
              minHeight: "20px",
              width: "100%",
              cursor: "pointer",
              color: "#cccccc",
              fontSize: "0.75rem",
              backgroundColor: "rgba(0, 0, 0, 0.1)",
              border: "none",
              borderBottom: "1px solid rgba(128, 128, 128, 0.2)",
              transition: "background-color 0.1s",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
            onClick={handleCreateEntity}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
            }}
          >
            <span className="codicon codicon-add" style={{ fontSize: "0.75rem" }} />
            <span>New Entity</span>
          </button>

          {/* Entity List */}
          <div
            style={{
              overflow: "auto",
              padding: 0,
              paddingBottom: "0.25rem",
              backgroundColor: "rgba(0, 0, 0, 0.1)",
              height: "120px",
              borderRadius: "0 0 2px 2px",
            }}
          >
            {entities.length === 0 ? (
              <div
                style={{
                  padding: "0.25rem 0.5rem",
                  minHeight: "20px",
                  color: "rgba(255, 255, 255, 0.6)",
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
                    cursor: "pointer",
                    color: "#cccccc",
                    fontSize: "0.75rem",
                    backgroundColor:
                      selectedEntity === entity
                        ? "#04395e"
                        : hoveredEntity === entity
                          ? "rgba(255, 255, 255, 0.1)"
                          : "transparent",
                    transition: "background-color 0.1s",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                  onClick={() => ecs.selectEntity(entity)}
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
                          fontSize: "0.75rem",
                          backgroundColor: "transparent",
                          color: "#cccccc",
                          border: "none",
                          outline: "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                          width: "100%",
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
                          style={{ display: "flex", gap: "0.125rem", alignItems: "center" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.125rem",
                              width: "16px",
                              height: "16px",
                              borderRadius: "2px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "rgba(255, 255, 255, 0.9)",
                              transition: "background-color 0.1s",
                            }}
                            onClick={(e) => handleStartRename(entity, e)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                            title="Rename entity"
                          >
                            <span className="codicon codicon-edit" style={{ fontSize: "0.75rem" }} />
                          </button>
                          <button
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.125rem",
                              width: "16px",
                              height: "16px",
                              borderRadius: "2px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#f48771",
                              transition: "background-color 0.1s",
                            }}
                            onClick={(e) => handleDeleteEntity(entity, e)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                            title="Delete entity"
                          >
                            <span className="codicon codicon-trash" style={{ fontSize: "0.75rem" }} />
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

