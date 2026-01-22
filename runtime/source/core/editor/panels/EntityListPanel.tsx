import { useState, useEffect, useRef } from "react";
import type { Entity } from "../../ecs/ecs";
import { useGameContext } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";
import { CaretDown, CaretRight, Plus, PencilSimple, Trash } from "@phosphor-icons/react";

export function EntityListPanel() {
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs as any;
  const [isExpanded, setIsExpanded] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);
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
      const success = ecs.renameEntity(renamingEntity, newName);
      if (success) {
        // Entity is already selected after rename, no need to call selectEntity
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
      className="flex flex-col w-[250px] rounded-sm"
      style={{
        fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
        backgroundColor: 'var(--vscode-panel-background, #3c3c3c)',
      }}
    >
      {/* Header */}
      <button
        className={`
          flex items-center justify-between w-full min-h-5 px-1 pl-2 py-1
          text-xs cursor-pointer outline-none select-none
          transition-colors duration-100 bg-transparent
          ${isExpanded
            ? "rounded-t-sm border-b"
            : "rounded-sm"
          }
        `}
        style={{
          color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
          borderBottomColor: isExpanded ? 'var(--vscode-panel-border, rgba(128, 128, 128, 0.2))' : 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Entities ({entities.length})</span>
        {isExpanded ? (
          <CaretDown size={12} weight="bold" className="ml-1" />
        ) : (
          <CaretRight size={12} weight="bold" className="ml-1" />
        )}
      </button>

      {isExpanded && (
        <>
          {/* New Entity Button */}
          <button
            className="
              flex items-center gap-1 w-full min-h-5 px-2 py-1
              text-xs cursor-pointer border-b
              transition-colors duration-100
            "
            style={{
              color: 'var(--vscode-foreground, #cccccc)',
              backgroundColor: 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.1))',
              borderBottomColor: 'var(--vscode-panel-border, rgba(128, 128, 128, 0.2))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.35))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.1))';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.4))';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.35))';
            }}
            onClick={handleCreateEntity}
          >
            <Plus size={12} weight="bold" />
            <span>New Entity</span>
          </button>

          {/* Entity List */}
          <div
            className="overflow-auto p-0 pb-1 h-[120px] rounded-b-sm"
            style={{
              backgroundColor: 'var(--vscode-list-inactiveSelectionBackground, rgba(0, 0, 0, 0.1))',
            }}
          >
            {entities.length === 0 ? (
              <div
                className="flex items-center justify-center min-h-5 px-2 py-1 text-xs"
                style={{
                  color: 'var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.6))',
                }}
              >
                No entities
              </div>
            ) : (
              entities.map((entity) => (
                <div
                  key={entity}
                  className={`
                    flex items-center gap-1 min-h-5 px-2 py-1
                    text-xs cursor-pointer
                    transition-colors duration-100
                  `}
                  style={{
                    color: 'var(--vscode-foreground, #cccccc)',
                    backgroundColor: selectedEntity === entity
                      ? 'var(--vscode-list-activeSelectionBackground, #04395e)'
                      : hoveredEntity === entity
                        ? 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))'
                        : 'transparent',
                  }}
                  onClick={() => ecs.selectEntity(entity)}
                  onMouseEnter={() => setHoveredEntity(entity)}
                  onMouseLeave={() => setHoveredEntity(null)}
                >
                  {renamingEntity === entity ? (
                    <form
                      onSubmit={handleRenameSubmit}
                      className="flex flex-1 min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={handleRenameSubmit}
                        className="
                          flex-1 p-0 text-xs bg-transparent text-[#cccccc]
                          border-none outline-none overflow-hidden
                          text-ellipsis whitespace-nowrap min-w-0 w-full
                        "
                      />
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {entity}
                      </span>
                      {hoveredEntity === entity && (
                        <div
                          className="flex gap-1.5 items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="
                              bg-transparent border-none cursor-pointer p-0
                              rounded-md flex items-center justify-center
                              transition-colors duration-100
                            "
                            style={{
                              color: 'var(--vscode-foreground, rgba(255, 255, 255, 0.9))',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={(e) => handleStartRename(entity, e)}
                            title="Rename entity"
                          >
                            <PencilSimple size={14} weight="bold" />
                          </button>
                          <button
                            className="
                              bg-transparent border-none cursor-pointer p-0
                              rounded-md flex items-center justify-center
                              transition-colors duration-100
                            "
                            style={{
                              color: 'var(--vscode-errorForeground, #f48771)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1))';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={(e) => handleDeleteEntity(entity, e)}
                            title="Delete entity"
                          >
                            <Trash size={14} weight="bold" />
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

