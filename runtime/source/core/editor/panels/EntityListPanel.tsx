import { useState, useEffect, useRef } from "react";
import type { Entity } from "../../ecs/ecs";
import { useGameContext } from "../EditorContext";
import { addDrawCallback, removeDrawCallback } from "../../gameloop";

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
      className="flex flex-col w-[250px] bg-gray-500/30 rounded-sm"
      style={{
        fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* Header */}
      <button
        className={`
          flex items-center justify-between w-full min-h-5 px-1 pl-2 py-1
          text-xs text-white/90 cursor-pointer outline-none select-none
          transition-colors duration-100
          ${isExpanded
            ? "rounded-t-sm border-b border-gray-500/20"
            : "rounded-sm"
          }
          hover:bg-gray-500/35
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Entities ({entities.length})</span>
        <span
          className={`codicon text-xs ml-1 ${isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"
            }`}
        />
      </button>

      {isExpanded && (
        <>
          {/* New Entity Button */}
          <button
            className="
              flex items-center gap-1 w-full min-h-5 px-2 py-1
              text-xs text-[#cccccc] cursor-pointer
              bg-black/10 border-b border-gray-500/20
              transition-colors duration-100
              hover:bg-white/10
            "
            onClick={handleCreateEntity}
          >
            <span className="codicon codicon-add" />
            <span>New Entity</span>
          </button>

          {/* Entity List */}
          <div className="overflow-auto p-0 pb-1 bg-black/10 h-[120px] rounded-b-sm">
            {entities.length === 0 ? (
              <div className="flex items-center justify-center min-h-5 px-2 py-1 text-xs text-white/60">
                No entities
              </div>
            ) : (
              entities.map((entity) => (
                <div
                  key={entity}
                  className={`
                    flex items-center gap-1 min-h-5 px-2 py-1
                    text-xs text-[#cccccc] cursor-pointer
                    transition-colors duration-100
                    ${selectedEntity === entity
                      ? "bg-[#04395e]"
                      : hoveredEntity === entity
                        ? "bg-white/10"
                        : "bg-transparent"
                    }
                  `}
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
                          className="flex gap-0.5 items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="
                              bg-transparent border-none cursor-pointer p-1
                              w-4 h-4 rounded-md flex items-center justify-center
                              text-white/90 transition-colors duration-100
                              hover:bg-white/10
                            "
                            onClick={(e) => handleStartRename(entity, e)}
                            title="Rename entity"
                          >
                            <span className="codicon codicon-edit text-[10px]" />
                          </button>
                          <button
                            className="
                              bg-transparent border-none cursor-pointer p-1
                              w-4 h-4 rounded-md flex items-center justify-center
                              text-[#f48771] transition-colors duration-100
                              hover:bg-white/10
                            "
                            onClick={(e) => handleDeleteEntity(entity, e)}
                            title="Delete entity"
                          >
                            <span className="codicon codicon-trash text-[10px]" />
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

